/**
 * A compiled and linked WebGL2 program with cached uniform locations and
 * typed setters. Compilation errors are re-thrown with line-numbered source,
 * so a GLSL typo points at the offending line instead of "link failed".
 */
export class ShaderProgram {
  readonly program: WebGLProgram;
  private readonly locations = new Map<string, WebGLUniformLocation | null>();

  constructor(
    private readonly gl: WebGL2RenderingContext,
    vertexSource: string,
    fragmentSource: string,
  ) {
    const vs = compile(gl, gl.VERTEX_SHADER, vertexSource);
    const fs = compile(gl, gl.FRAGMENT_SHADER, fragmentSource);
    const program = gl.createProgram();
    gl.attachShader(program, vs);
    gl.attachShader(program, fs);
    gl.linkProgram(program);
    gl.deleteShader(vs);
    gl.deleteShader(fs);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      const log = gl.getProgramInfoLog(program);
      gl.deleteProgram(program);
      throw new Error(`Program link failed: ${log}`);
    }
    this.program = program;
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

function compile(gl: WebGL2RenderingContext, type: GLenum, source: string): WebGLShader {
  const shader = gl.createShader(type);
  if (!shader) throw new Error('Could not create shader');
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const log = gl.getShaderInfoLog(shader);
    gl.deleteShader(shader);
    const numbered = source
      .split('\n')
      .map((line, i) => `${String(i + 1).padStart(4)}  ${line}`)
      .join('\n');
    throw new Error(`Shader compile failed:\n${log}\n${numbered}`);
  }
  return shader;
}
