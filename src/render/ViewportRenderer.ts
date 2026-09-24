import type { RenderFamily } from '../fractals/definition';
import { FRACTAL_INFO, isEscapeScene, isRasterScene } from '../fractals/registry';
import type { EscapeScene, FractalKind, RasterScene, SceneSnapshot } from '../fractals/types';
import type { RenderStats } from '../gl/FractalRenderer';
import type { ExportOptions, RenderEngine, ViewportSize } from './engine';
import type { RasterRendererStats } from './RasterRenderer';

export type ViewportStats = ({ family: 'escape' } & RenderStats) | ({ family: 'raster' } & RasterRendererStats);

/** What the viewport is doing, for the loading UI. */
export type SessionState =
  | { phase: 'loading'; kind: FractalKind; task: string }
  | { phase: 'ready'; kind: FractalKind }
  | { phase: 'error'; kind: FractalKind; message: string };

export interface EngineFactories {
  escape(onStats: (stats: RenderStats) => void): RenderEngine<EscapeScene>;
  raster(onStats: (stats: RasterRendererStats) => void): RenderEngine<RasterScene>;
}

export interface ViewportCallbacks {
  onStats(stats: ViewportStats | null): void;
  onSession(session: SessionState): void;
  /** Called when a family's canvas becomes the visible one. */
  onFamilyChange?(family: RenderFamily): void;
}

/**
 * The single renderer the app talks to, and the owner of the render
 * *session*: exactly one pipeline is live at a time.
 *
 * - Engines are created on first use: open an L-system first and no WebGL
 *   context is ever created; stay on Mandelbrot and no worker is spawned.
 * - Switching family suspends the old engine (freeing its buffers, canvas
 *   backing store, worker and caches) before the new one resumes.
 * - Switching kind within a family only prepares the new kind (e.g. compiles
 *   Julia's shader once), so Mandelbrot ⇄ Julia is instant after first use.
 * - While a switch is preparing, scene updates are buffered and the newest
 *   one is applied when it's ready. A generation token discards the result
 *   of a switch that was superseded by another.
 */
export class ViewportRenderer {
  private engines: { escape?: RenderEngine<EscapeScene>; raster?: RenderEngine<RasterScene> } = {};
  private family: RenderFamily | null = null;
  private kind: FractalKind | null = null;
  private ready = false;
  private latest: SceneSnapshot | null = null;
  private generation = 0;
  private size: ViewportSize = { width: 1, height: 1, devicePixelRatio: 1 };
  /** Kinds whose engine has already prepared once this session (shader compiled, etc.). */
  private warm = new Set<FractalKind>();

  constructor(
    private readonly factories: EngineFactories,
    private readonly callbacks: ViewportCallbacks,
  ) {}

  setScene(scene: SceneSnapshot): void {
    this.latest = scene;
    if (scene.fractal.kind !== this.kind) {
      void this.switchTo(scene);
      return;
    }
    if (this.ready) this.route(scene);
  }

  resize(size: ViewportSize): void {
    this.size = size;
    if (this.family) this.engine(this.family)?.resize(size);
  }

  /** Viewport size in CSS pixels, for mapping pointer input to the plane. */
  get viewportSize(): { width: number; height: number } {
    return { width: this.size.width, height: this.size.height };
  }

  renderImage(scene: SceneSnapshot, width: number, height: number, options: ExportOptions): Promise<HTMLCanvasElement> {
    if (isEscapeScene(scene)) return this.escapeEngine().renderImage(scene, width, height, options);
    if (isRasterScene(scene)) return this.rasterEngine().renderImage(scene, width, height, options);
    return Promise.reject(new Error(`No renderer for ${scene.fractal.kind}`));
  }

  dispose(): void {
    this.generation++;
    this.engines.escape?.dispose();
    this.engines.raster?.dispose();
    this.engines = {};
  }

  // --- Session switching ------------------------------------------------------

  private async switchTo(scene: SceneSnapshot): Promise<void> {
    const token = ++this.generation;
    const kind = scene.fractal.kind;
    const family = FRACTAL_INFO[kind].family;
    // Same live engine, kind already prepared once: the switch is instant, so skip the loading state.
    const instant = family === this.family && this.warm.has(kind);
    this.kind = kind;
    this.ready = false;
    this.callbacks.onStats(null);
    if (!instant) this.callbacks.onSession({ phase: 'loading', kind, task: this.taskFor(kind, family) });

    try {
      if (family !== this.family) {
        if (this.family) this.engine(this.family)?.suspend();
        this.family = family;
        const engine = family === 'escape' ? this.escapeEngine() : this.rasterEngine();
        engine.resume(this.size);
        this.callbacks.onFamilyChange?.(family);
      }
      await this.prepare(scene);
      if (token !== this.generation) return; // superseded by a newer switch
      this.warm.add(kind);
      this.ready = true;
      // Apply whatever arrived while preparing (pans, param edits).
      if (this.latest && this.latest !== scene && this.latest.fractal.kind === kind) this.route(this.latest);
      this.callbacks.onSession({ phase: 'ready', kind });
    } catch (error) {
      if (token !== this.generation) return;
      console.error(error);
      const message = error instanceof Error ? error.message.split('\n')[0]! : String(error);
      this.callbacks.onSession({ phase: 'error', kind, message });
    }
  }

  private prepare(scene: SceneSnapshot): Promise<void> {
    if (isEscapeScene(scene)) {
      const engine = this.escapeEngine();
      return engine.prepare(scene).then(() => engine.setScene(scene));
    }
    if (isRasterScene(scene)) return this.rasterEngine().prepare(scene);
    return Promise.reject(new Error(`No renderer for ${scene.fractal.kind}`));
  }

  private route(scene: SceneSnapshot): void {
    if (isEscapeScene(scene)) this.engines.escape?.setScene(scene);
    else if (isRasterScene(scene)) this.engines.raster?.setScene(scene);
  }

  private taskFor(kind: FractalKind, family: RenderFamily): string {
    if (family === 'raster') return this.warm.has(kind) ? 'Redrawing' : 'Starting worker';
    return this.warm.has(kind) ? 'Restoring buffers' : 'Compiling shaders';
  }

  // --- Engines (created on first use) -------------------------------------------

  private engine(family: RenderFamily): RenderEngine<EscapeScene> | RenderEngine<RasterScene> | undefined {
    return family === 'escape' ? this.engines.escape : this.engines.raster;
  }

  private escapeEngine(): RenderEngine<EscapeScene> {
    return (this.engines.escape ??= this.factories.escape(
      (s) => this.family === 'escape' && this.ready && this.callbacks.onStats({ family: 'escape', ...s }),
    ));
  }

  private rasterEngine(): RenderEngine<RasterScene> {
    return (this.engines.raster ??= this.factories.raster(
      (s) => this.family === 'raster' && this.callbacks.onStats({ family: 'raster', ...s }),
    ));
  }
}
