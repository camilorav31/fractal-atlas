/**
 * A compiled and linked WebGL2 program with cached uniform locations and
 * typed setters. Compilation errors are re-thrown with line-numbered source,
 * so a GLSL typo points at the offending line instead of "link failed".
 */
export class ShaderProgram {
  private readonly locations = new Map<string, WebGLUniformLocation | null>();

  private constructor(
    private readonly gl: WebGL2RenderingContext,
    readonly program: WebGLProgram,
  ) {}

  /** Compiles synchronously — fine for tiny shaders like the present pass. */
  static create(gl: WebGL2RenderingContext, vertexSource: string, fragmentSource: string): ShaderProgram {
    const pending = startCompile(gl, vertexSource, fragmentSource);
    return new ShaderProgram(gl, finishCompile(gl, pending));
  }

  /**
   * Compiles without blocking the main thread. With KHR_parallel_shader_compile
   * the driver compiles on a background thread and we poll for completion;
   * without it we still yield first so a loading state can paint. The df64
   * escape shaders are large enough that this matters on some drivers.
   */
  static async compile(gl: WebGL2RenderingContext, vertexSource: string, fragmentSource: string): Promise<ShaderProgram> {
    const parallel = gl.getExtension('KHR_parallel_shader_compile') as { COMPLETION_STATUS_KHR: GLenum } | null;
    const pending = startCompile(gl, vertexSource, fragmentSource);
    await nextFrame();
    if (parallel) {
      while (!gl.getProgramParameter(pending.program, parallel.COMPLETION_STATUS_KHR)) await nextFrame();
    }
    return new ShaderProgram(gl, finishCompile(gl, pending));
  }

  use(): this {
    this.gl.useProgram(this.program);
    return this;
  }

  private location(name: string): WebGLUniformLocation | null {
    let loc = this.locations.get(name);
    if (loc === undefined) {
      // Uniforms the compiler optimized away resolve to null; setting them is a no-op.
      loc = this.gl.getUniformLocation(this.program, name);
      this.locations.set(name, loc);
    }
    return loc;
  }

  int(name: string, value: number): this {
    this.gl.uniform1i(this.location(name), value);
    return this;
  }

  uint(name: string, value: number): this {
    this.gl.uniform1ui(this.location(name), value);
    return this;
  }

  bool(name: string, value: boolean): this {
    return this.int(name, value ? 1 : 0);
  }

  float(name: string, value: number): this {
    this.gl.uniform1f(this.location(name), value);
    return this;
  }

  vec2(name: string, x: number, y: number): this {
    this.gl.uniform2f(this.location(name), x, y);
    return this;
  }

  vec3(name: string, [x, y, z]: readonly [number, number, number]): this {
    this.gl.uniform3f(this.location(name), x, y, z);
    return this;
  }

  vec4(name: string, x: number, y: number, z: number, w: number): this {
    this.gl.uniform4f(this.location(name), x, y, z, w);
    return this;
  }

  dispose(): void {
    this.gl.deleteProgram(this.program);
  }
}

interface PendingProgram {
  program: WebGLProgram;
  shaders: [WebGLShader, string][];
}

/** Issues compile + link without querying status, which would force a synchronous wait. */
function startCompile(gl: WebGL2RenderingContext, vertexSource: string, fragmentSource: string): PendingProgram {
  const program = gl.createProgram();
  const shaders: [WebGLShader, string][] = [
    [gl.VERTEX_SHADER, vertexSource],
    [gl.FRAGMENT_SHADER, fragmentSource],
  ].map(([type, source]) => {
    const shader = gl.createShader(type as GLenum);
    if (!shader) throw new Error('Could not create shader');
    gl.shaderSource(shader, source as string);
    gl.compileShader(shader);
    gl.attachShader(program, shader);
    return [shader, source as string];
  });
  gl.linkProgram(program);
  return { program, shaders };
}

function finishCompile(gl: WebGL2RenderingContext, { program, shaders }: PendingProgram): WebGLProgram {
  try {
    for (const [shader, source] of shaders) {
      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        const numbered = source
          .split('\n')
          .map((line, i) => `${String(i + 1).padStart(4)}  ${line}`)
          .join('\n');
        throw new Error(`Shader compile failed:\n${gl.getShaderInfoLog(shader)}\n${numbered}`);
      }
    }
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      throw new Error(`Program link failed: ${gl.getProgramInfoLog(program)}`);
    }
    return program;
  } catch (error) {
    gl.deleteProgram(program);
    throw error;
  } finally {
    for (const [shader] of shaders) gl.deleteShader(shader);
  }
}

const nextFrame = () => new Promise<void>((resolve) => setTimeout(resolve, 16));
