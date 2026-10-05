import { CURATED } from '../fractals/curated';
import { FRACTAL_KINDS, isEscapeScene, isRasterScene } from '../fractals/registry';
import type { ColorSettings, ComplexView, FractalKind, SceneSnapshot } from '../fractals/types';
import { defaultSnapshot } from '../store/defaults';
import { FractalRenderer } from '../gl/FractalRenderer';
import { RasterRenderer } from '../render/RasterRenderer';

/**
 * Offscreen scene rendering shared by the film harnesses (README showreel,
 * promo). Scenes are described by reference and rendered through the app's
 * own engines, so a film frame is exactly what the app would export.
 */

/** A scene described by reference: a curated view (or a kind's default) plus overrides. */
export interface SceneSpec {
  curated?: string;
  kind?: FractalKind;
  view?: Partial<ComplexView>;
  /** Added to the resolved view's zoom (for drifting shots of curated views). */
  zoomDelta?: number;
  color?: Partial<ColorSettings>;
  params?: Record<string, unknown>;
}

export function resolveScene(spec: SceneSpec): SceneSnapshot {
  const curated = spec.curated
    ? FRACTAL_KINDS.flatMap((k) => CURATED[k]).find((v) => v.id === spec.curated)?.snapshot
    : undefined;
  if (spec.curated && !curated) throw new Error(`Unknown curated view: ${spec.curated}`);
  const base = structuredClone(curated ?? defaultSnapshot(spec.kind ?? 'mandelbrot'));
  const view = { ...base.view, ...spec.view };
  return {
    fractal: { ...base.fractal, params: { ...base.fractal.params, ...spec.params } } as SceneSnapshot['fractal'],
    view: { ...view, zoomLog: view.zoomLog + (spec.zoomDelta ?? 0) },
    color: { ...base.color, ...spec.color },
  };
}

/** Both engines stay suspended: nothing is drawn to a visible canvas, only offscreen renders. */
export class SceneRenderer {
  private readonly gpu = new FractalRenderer(document.createElement('canvas'));
  private readonly raster = new RasterRenderer(document.createElement('canvas'));

  render(spec: SceneSpec, width: number, height: number, samples: number): Promise<HTMLCanvasElement> {
    const scene = resolveScene(spec);
    if (isEscapeScene(scene)) return this.gpu.renderImage(scene, width, height, { samples });
    if (isRasterScene(scene)) return this.raster.renderImage(scene, width, height, { samples });
    throw new Error(`No renderer for ${scene.fractal.kind}`);
  }
}

/** The renderer's GPU, as reported by WebGL, for the render log. */
export function gpuInfo(): string {
  const gl = document.createElement('canvas').getContext('webgl2');
  const ext = gl?.getExtension('WEBGL_debug_renderer_info');
  return gl && ext ? String(gl.getParameter(ext.UNMASKED_RENDERER_WEBGL)) : gl ? 'WebGL2 (renderer hidden)' : 'no WebGL2';
}
