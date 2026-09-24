import vertexShader from '../shaders/fullscreen.vert';
import presentShader from '../shaders/present.frag';
import { FRACTALS, bindFractal } from '../fractals/registry';
import type { EscapeKind, EscapeScene } from '../fractals/types';
import type { ExportOptions, RenderEngine, ViewportSize } from '../render/engine';
import { hexToLinear } from '../utils/color';
import { resolveStops } from '../utils/palettes';
import { needsDoublePrecision, pixelSize, splitDouble } from '../utils/viewMath';
import { PaletteTexture } from './paletteTexture';
import { RenderTarget, accumulationFormat } from './RenderTarget';
import { ShaderProgram } from './ShaderProgram';

export interface RenderStats {
  samples: number;
  targetSamples: number;
  precision: 'fp32' | 'df64';
  iterations: number;
  /** Fraction of full resolution used for the last interactive frame. */
  resolutionScale: number;
}

/** How long the scene must stay unchanged before refinement starts (ms). */
const SETTLE_MS = 110;
/** Samples accumulated on screen once the view settles. */
const SCREEN_SAMPLES = 24;
/** Largest tile edge for offscreen renders. */
const EXPORT_TILE = 1024;
const MIN_EXPORT_TILE = 128;
/**
 * Work allowed in a single offscreen draw, in fp32 pixel-iterations. GPUs kill
 * draws that run for more than a few seconds (the watchdog loses the context),
 * so deep, iteration-heavy views are split into smaller tiles.
 */
const DRAW_WORK_BUDGET = 1024 * 1024 * 800;
/** Rough cost of one df64 iteration relative to fp32 (a dozen ops per float op). */
const DF64_COST = 12;
const MIN_SCALE = 0.3;
const MAX_DPR = 2;

/**
 * Owns the WebGL2 context and turns an escape-time scene into pixels.
 *
 * Rendering is *on demand*: nothing is drawn while the scene is static and
 * fully refined. The pipeline has two passes:
 *
 *   1. Fractal pass → accumulation buffer. Each draw computes one jittered
 *      sample per pixel and is blended in as a running average, so
 *      supersampling is spread across frames instead of one long draw.
 *   2. Present pass → screen (or an export tile): linear → sRGB + dither.
 *
 * While the scene is changing, a single sample is drawn at a dynamic
 * resolution tuned from frame time, keeping interaction at display rate
 * even for deep df64 views with thousands of iterations.
 *
 * Lifecycle: created suspended. Each fractal's shader is compiled the first
 * time it is prepared (off the main thread where supported) and cached — a
 * linked program is a few KB, recompiling costs 50–200 ms. `suspend` frees
 * what actually weighs: the drawing buffer and the RGBA16F accumulation
 * buffer (~30 MB on a Retina display).
 */
export class FractalRenderer implements RenderEngine<EscapeScene> {
  private readonly gl: WebGL2RenderingContext;
  private programs = new Map<EscapeKind, ShaderProgram>();
  private compiling = new Map<EscapeKind, Promise<ShaderProgram>>();
  private present!: ShaderProgram;
  private vao!: WebGLVertexArrayObject;
  private accumulation!: RenderTarget;
  private palette!: PaletteTexture;

  private scene: EscapeScene | null = null;
  private cssWidth = 1;
  private cssHeight = 1;
  private dpr = 1;

  private rafId = 0;
  private dirty = false;
  private lastChange = 0;
  private lastFrameTime = 0;
  private lastFrameWasInteractive = false;
  private samples = 0;
  private renderedScale = 1;
  private dynamicScale = 1;
  private paused = false;
  private suspended = true;
  private offscreenQueue: Promise<unknown> = Promise.resolve();
  private contextLost = false;

  constructor(
    private readonly canvas: HTMLCanvasElement,
    private readonly onStats: (stats: RenderStats) => void = () => {},
  ) {
    const gl = canvas.getContext('webgl2', {
      alpha: false,
      antialias: false,
      depth: false,
      stencil: false,
      premultipliedAlpha: false,
      powerPreference: 'high-performance',
    });
    if (!gl) throw new Error('WebGL2 is not supported on this device.');
    this.gl = gl;
    this.initResources();
    canvas.addEventListener('webglcontextlost', this.handleContextLost);
    canvas.addEventListener('webglcontextrestored', this.handleContextRestored);
  }

  // --- Public API -----------------------------------------------------------

  setScene(scene: EscapeScene): void {
    this.scene = scene;
    this.dirty = true;
    this.lastChange = performance.now();
    this.requestFrame();
  }

  /** Compiles the scene's shader if needed; resolves once it can be drawn. */
  async prepare(scene: EscapeScene): Promise<void> {
    await this.programFor(scene.fractal.kind);
  }

  resume(size: ViewportSize): void {
    this.suspended = false;
    this.resize(size);
  }

  suspend(): void {
    this.suspended = true;
    cancelAnimationFrame(this.rafId);
    this.rafId = 0;
    if (!this.contextLost) this.accumulation.release();
    // Shrinking the canvas releases its drawing buffer too.
    this.canvas.width = 1;
    this.canvas.height = 1;
  }

  resize({ width, height, devicePixelRatio }: ViewportSize): void {
    this.cssWidth = Math.max(1, width);
    this.cssHeight = Math.max(1, height);
    this.dpr = Math.min(devicePixelRatio, MAX_DPR);
    if (this.suspended) return; // applied on resume
    this.canvas.width = Math.round(this.cssWidth * this.dpr);
    this.canvas.height = Math.round(this.cssHeight * this.dpr);
    if (!this.contextLost) this.accumulation.resize(this.canvas.width, this.canvas.height);
    this.dirty = true;
    this.requestFrame();
  }

  private programFor(kind: EscapeKind): Promise<ShaderProgram> {
    const ready = this.programs.get(kind);
    if (ready) return Promise.resolve(ready);
    let pending = this.compiling.get(kind);
    if (!pending) {
      pending = ShaderProgram.compile(this.gl, vertexShader, FRACTALS[kind].fragmentShader)
        .then((program) => {
          this.programs.set(kind, program);
          return program;
        })
        .finally(() => this.compiling.delete(kind));
      this.compiling.set(kind, pending);
    }
    return pending;
  }

  /**
   * Renders `scene` offscreen at an arbitrary resolution, tile by tile, and
   * returns it on a 2D canvas. Yields to the event loop between GPU draws,
   * so the UI stays responsive (and cancellable) during multi-second exports.
   */
  renderImage(scene: EscapeScene, width: number, height: number, options: ExportOptions): Promise<HTMLCanvasElement> {
    // Offscreen jobs share GL state, so they run strictly one after another.
    const job = this.offscreenQueue.then(() => this.renderImageNow(scene, width, height, options));
    this.offscreenQueue = job.catch(() => undefined);
    return job;
  }

  private async renderImageNow(
    scene: EscapeScene,
    width: number,
    height: number,
    { samples, onProgress, signal }: ExportOptions,
  ): Promise<HTMLCanvasElement> {
    const { gl } = this;
    await this.programFor(scene.fractal.kind);
    const tile = Math.min(
      exportTileFor(scene, height),
      gl.getParameter(gl.MAX_TEXTURE_SIZE) as number,
      ...(gl.getParameter(gl.MAX_VIEWPORT_DIMS) as Int32Array),
    );
    const accum = new RenderTarget(gl, this.accumulation.format);
    const output = new RenderTarget(gl, 'rgba8');
    accum.resize(tile, tile);
    output.resize(tile, tile);

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Could not create a 2D canvas for export.');

    const pixels = new Uint8Array(tile * tile * 4);
    const tilesX = Math.ceil(width / tile);
    const tilesY = Math.ceil(height / tile);
    const totalDraws = tilesX * tilesY * samples;
    let draws = 0;

    this.paused = true;
    try {
      for (let ty = 0; ty < height; ty += tile) {
        for (let tx = 0; tx < width; tx += tile) {
          const tw = Math.min(tile, width - tx);
          const th = Math.min(tile, height - ty);
          for (let s = 0; s < samples; s++) {
            signal?.throwIfAborted();
            this.drawSample(accum, scene, { tw, th, imageW: width, imageH: height, tx, ty, sample: s });
            await this.waitForGpu();
            onProgress?.(++draws / totalDraws);
          }
          this.presentTo(output, accum, tw, th, 0);
          gl.readPixels(0, 0, tw, th, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
          ctx.putImageData(flipRows(pixels, tw, th), tx, height - ty - th);
        }
      }
    } finally {
      accum.dispose();
      output.dispose();
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      this.paused = false;
      this.requestFrame(); // resume any refinement or pending change deferred while paused
    }
    return canvas;
  }

  dispose(): void {
    cancelAnimationFrame(this.rafId);
    this.canvas.removeEventListener('webglcontextlost', this.handleContextLost);
    this.canvas.removeEventListener('webglcontextrestored', this.handleContextRestored);
    if (!this.contextLost) this.releaseResources();
  }

  // --- Frame loop -----------------------------------------------------------

  private requestFrame(): void {
    if (!this.rafId && !this.contextLost && !this.suspended) this.rafId = requestAnimationFrame(this.frame);
  }

  private frame = (time: number): void => {
    this.rafId = 0;
    if (this.paused || this.suspended || !this.scene) return;
    if (!this.programs.has(this.scene.fractal.kind)) {
      // Not compiled yet (e.g. after a context restore): compile, then draw.
      void this.programFor(this.scene.fractal.kind).then(() => this.requestFrame());
      return;
    }

    const frameDelta = time - this.lastFrameTime;
    this.lastFrameTime = time;
    const settling = performance.now() - this.lastChange < SETTLE_MS;

    if (settling) {
      if (this.dirty) {
        if (this.lastFrameWasInteractive && frameDelta < 250) this.adaptScale(frameDelta);
        this.renderedScale = this.dynamicScale;
        this.samples = 0;
        this.accumulateScreenSample();
        this.dirty = false;
        this.lastFrameWasInteractive = true;
      } else {
        this.lastFrameWasInteractive = false;
      }
      this.requestFrame(); // keep ticking until the scene settles
      return;
    }

    this.lastFrameWasInteractive = false;
    if (this.dirty || this.renderedScale !== 1) {
      this.renderedScale = 1;
      this.samples = 0;
      this.dirty = false;
    }
    if (this.samples < SCREEN_SAMPLES) {
      this.accumulateScreenSample();
      this.requestFrame();
    }
  };

  /** Frame-time feedback: shrink resolution when slow, grow back when there's headroom. */
  private adaptScale(frameDelta: number): void {
    if (frameDelta > 28) this.dynamicScale = Math.max(MIN_SCALE, this.dynamicScale * 0.8);
    else if (frameDelta < 18) this.dynamicScale = Math.min(1, this.dynamicScale * 1.08);
  }

  private accumulateScreenSample(): void {
    const scene = this.scene!;
    const tw = Math.max(1, Math.round(this.canvas.width * this.renderedScale));
    const th = Math.max(1, Math.round(this.canvas.height * this.renderedScale));
    this.drawSample(this.accumulation, scene, { tw, th, imageW: tw, imageH: th, tx: 0, ty: 0, sample: this.samples });
    this.samples++;

    const { gl } = this;
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, this.canvas.width, this.canvas.height);
    this.drawPresent(this.accumulation, tw, th, 0.22);

    this.onStats({
      samples: this.samples,
      targetSamples: this.renderedScale === 1 ? SCREEN_SAMPLES : 1,
      precision: needsDoublePrecision(scene.view, th) ? 'df64' : 'fp32',
      iterations: bindFractal(scene.fractal).iterations(scene.view.zoomLog),
      resolutionScale: this.renderedScale,
    });
  }

  // --- Passes ---------------------------------------------------------------

  /**
   * Draws one jittered sample of the fractal into `target` and blends it into
   * the running average. `tx/ty` and `imageW/imageH` locate the tile inside
   * the full image, which is what makes tiled export seamless.
   */
  private drawSample(
    target: RenderTarget,
    scene: EscapeScene,
    r: { tw: number; th: number; imageW: number; imageH: number; tx: number; ty: number; sample: number },
  ): void {
    const { gl } = this;
    const fractal = bindFractal(scene.fractal);
    const program = this.programs.get(scene.fractal.kind)!;
    const { view, color } = scene;
    const [xHi, xLo] = splitDouble(view.centerX);
    const [yHi, yLo] = splitDouble(view.centerY);
    const [jx, jy] = jitter(r.sample);

    gl.bindFramebuffer(gl.FRAMEBUFFER, target.framebuffer);
    gl.viewport(0, 0, r.tw, r.th);
    if (r.sample === 0) {
      gl.disable(gl.BLEND);
    } else {
      // Running mean: new = old·(1 − 1/n) + sample·(1/n)
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.CONSTANT_ALPHA, gl.ONE_MINUS_CONSTANT_ALPHA);
      gl.blendColor(0, 0, 0, 1 / (r.sample + 1));
    }

    this.palette.update(resolveStops(color));
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.palette.texture);

    program
      .use()
      .vec2('u_resolution', r.imageW, r.imageH)
      .vec2('u_tileOffset', r.tx, r.ty)
      .vec2('u_jitter', jx, jy)
      .vec4('u_center', xHi, yHi, xLo, yLo)
      .float('u_scale', pixelSize(view.zoomLog, r.imageH))
      .int('u_maxIterations', fractal.iterations(view.zoomLog))
      .bool('u_useDf64', needsDoublePrecision(view, r.imageH))
      .uint('u_zero', 0) // see opaque() in df64.glsl
      .int('u_palette', 0)
      .float('u_colorDensity', color.density)
      .float('u_colorOffset', color.offset)
      .float('u_edgeShading', color.edgeShading)
      .vec3('u_interiorColor', hexToLinear(color.interior))
      .bool('u_linearOutput', target.format === 'rgba16f');
    fractal.bindUniforms(program);

    gl.bindVertexArray(this.vao);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    gl.disable(gl.BLEND);
  }

  private presentTo(output: RenderTarget, source: RenderTarget, tw: number, th: number, vignette: number) {
    const { gl } = this;
    gl.bindFramebuffer(gl.FRAMEBUFFER, output.framebuffer);
    gl.viewport(0, 0, tw, th);
    this.drawPresent(source, tw, th, vignette);
  }

  private drawPresent(source: RenderTarget, tw: number, th: number, vignette: number): void {
    const { gl } = this;
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, source.texture);
    this.present
      .use()
      .int('u_image', 0)
      .vec2('u_uvScale', tw / source.width, th / source.height)
      .bool('u_linearInput', source.format === 'rgba16f')
      .float('u_vignette', vignette)
      .float('u_seed', 0);
    gl.bindVertexArray(this.vao);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }

  /** Resolves once the GPU has drained its queue, without blocking the main thread. */
  private waitForGpu(): Promise<void> {
    const { gl } = this;
    const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
    gl.flush();
    return new Promise((resolve) => {
      const poll = () => {
        const status = sync ? gl.clientWaitSync(sync, 0, 0) : gl.ALREADY_SIGNALED;
        if (status === gl.TIMEOUT_EXPIRED) {
          setTimeout(poll, 1);
          return;
        }
        if (sync) gl.deleteSync(sync);
        resolve();
      };
      setTimeout(poll, 0);
    });
  }

  // --- Resources & context loss ---------------------------------------------

  private initResources(): void {
    const { gl } = this;
    // Fractal programs are compiled lazily, per kind, in programFor().
    this.programs = new Map();
    this.compiling = new Map();
    this.present = ShaderProgram.create(gl, vertexShader, presentShader);
    this.vao = gl.createVertexArray();
    this.accumulation = new RenderTarget(gl, accumulationFormat(gl));
    if (!this.suspended) this.accumulation.resize(this.canvas.width, this.canvas.height);
    this.palette = new PaletteTexture(gl);
  }

  private releaseResources(): void {
    this.programs.forEach((p) => p.dispose());
    this.present.dispose();
    this.gl.deleteVertexArray(this.vao);
    this.accumulation.dispose();
    this.palette.dispose();
  }

  private handleContextLost = (event: Event): void => {
    event.preventDefault(); // signals that we intend to restore
    this.contextLost = true;
    cancelAnimationFrame(this.rafId);
    this.rafId = 0;
  };

  private handleContextRestored = (): void => {
    this.contextLost = false;
    this.initResources();
    this.dirty = true;
    this.requestFrame();
  };
}

/** Tile edge that keeps one draw of `scene` within the per-draw work budget. */
function exportTileFor(scene: EscapeScene, imageHeight: number): number {
  const iterations = bindFractal(scene.fractal).iterations(scene.view.zoomLog);
  const cost = iterations * (needsDoublePrecision(scene.view, imageHeight) ? DF64_COST : 1);
  const edge = Math.sqrt(DRAW_WORK_BUDGET / cost);
  return Math.max(MIN_EXPORT_TILE, Math.min(EXPORT_TILE, Math.floor(edge / 64) * 64));
}

/** R2 low-discrepancy sequence (Roberts, 2018), centred so sample 0 has no jitter. */
function jitter(index: number): [number, number] {
  const g = 1.324717957244746;
  return [((0.5 + index / g) % 1) - 0.5, ((0.5 + index / (g * g)) % 1) - 0.5];
}

/** WebGL reads bottom-up; canvas ImageData is top-down. */
function flipRows(pixels: Uint8Array, width: number, height: number): ImageData {
  const image = new ImageData(width, height);
  const rowBytes = width * 4;
  for (let row = 0; row < height; row++) {
    const src = (height - 1 - row) * rowBytes;
    image.data.set(pixels.subarray(src, src + rowBytes), row * rowBytes);
  }
  return image;
}
