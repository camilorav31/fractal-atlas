import { isEscapeScene, isRasterScene } from '../fractals/registry';
import type { SceneSnapshot } from '../fractals/types';
import { FractalRenderer, type ExportOptions, type RenderStats } from '../gl/FractalRenderer';
import { RasterRenderer, type RasterRendererStats } from './RasterRenderer';

export type ViewportStats = ({ family: 'escape' } & RenderStats) | ({ family: 'raster' } & RasterRendererStats);

/**
 * The single renderer the app talks to. Routes each scene to the pipeline
 * for its family — WebGL for escape-time fractals, the worker-backed 2D
 * canvas for L-systems — and shows only the active canvas.
 */
export class ViewportRenderer {
  private readonly gpu: FractalRenderer;
  private readonly raster: RasterRenderer;
  private active: 'escape' | 'raster' | null = null;

  constructor(
    private readonly glCanvas: HTMLCanvasElement,
    private readonly rasterCanvas: HTMLCanvasElement,
    onStats: (stats: ViewportStats) => void,
  ) {
    this.gpu = new FractalRenderer(glCanvas, (s) => this.active === 'escape' && onStats({ family: 'escape', ...s }));
    this.raster = new RasterRenderer(rasterCanvas, (s) => this.active === 'raster' && onStats({ family: 'raster', ...s }));
  }

  setScene(scene: SceneSnapshot): void {
    if (isEscapeScene(scene)) {
      this.activate('escape');
      this.gpu.setScene(scene);
    } else if (isRasterScene(scene)) {
      this.activate('raster');
      this.raster.setScene(scene);
    }
  }

  resize(cssWidth: number, cssHeight: number, devicePixelRatio: number): void {
    this.gpu.resize(cssWidth, cssHeight, devicePixelRatio);
    this.raster.resize(cssWidth, cssHeight, devicePixelRatio);
  }

  /** Viewport size in CSS pixels, for mapping pointer input to the plane. */
  get viewportSize(): { width: number; height: number } {
    return this.gpu.viewportSize;
  }

  renderImage(scene: SceneSnapshot, width: number, height: number, options: ExportOptions): Promise<HTMLCanvasElement> {
    if (isEscapeScene(scene)) return this.gpu.renderImage(scene, width, height, options);
    if (isRasterScene(scene)) return this.raster.renderImage(scene, width, height, options);
    throw new Error(`No renderer for ${scene.fractal.kind}`);
  }

  dispose(): void {
    this.gpu.dispose();
    this.raster.dispose();
  }

  private activate(family: 'escape' | 'raster'): void {
    if (this.active === family) return;
    this.active = family;
    this.glCanvas.style.visibility = family === 'escape' ? 'visible' : 'hidden';
    this.rasterCanvas.style.visibility = family === 'raster' ? 'visible' : 'hidden';
  }
}
