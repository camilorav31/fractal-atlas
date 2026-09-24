import { CURATED } from '../fractals/curated';
import { FRACTAL_KINDS, isEscapeScene, isRasterScene } from '../fractals/registry';
import type { ColorSettings, ComplexView, FractalKind, SceneSnapshot } from '../fractals/types';
import { defaultSnapshot } from '../store/defaults';
import { FractalRenderer } from '../gl/FractalRenderer';
import { RasterRenderer } from '../render/RasterRenderer';

/**
 * Showreel capture harness: renders frames through the app's own engines,
 * offscreen, with no UI. Driven frame by frame from Node (scripts/showreel.mjs)
 * so the video has a perfectly steady frame rate regardless of render time.
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

export interface Layer {
  scene: SceneSpec;
  /** Opacity in [0, 1]; layers are composited in order (used for crossfades). */
  alpha: number;
}

export interface FrameRequest {
  layers: Layer[];
  width: number;
  height: number;
  /** Supersamples per pixel for escape-time layers. */
  samples: number;
  /** Radial darkening at the corners, in [0, 1]. */
  vignette: number;
  /** Global fade to black, in [0, 1] (1 = fully visible). */
  fade: number;
}

// Both engines stay suspended: nothing is drawn to a visible canvas, only offscreen renders.
const gpu = new FractalRenderer(document.createElement('canvas'));
const raster = new RasterRenderer(document.createElement('canvas'));
const compose = document.createElement('canvas');
const ctx = compose.getContext('2d')!;

function resolve(spec: SceneSpec): SceneSnapshot {
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

function render(scene: SceneSnapshot, width: number, height: number, samples: number): Promise<HTMLCanvasElement> {
  if (isEscapeScene(scene)) return gpu.renderImage(scene, width, height, { samples });
  if (isRasterScene(scene)) return raster.renderImage(scene, width, height, { samples });
  throw new Error(`No renderer for ${scene.fractal.kind}`);
}

async function frame({ layers, width, height, samples, vignette, fade }: FrameRequest): Promise<string> {
  compose.width = width;
  compose.height = height;
  ctx.globalAlpha = 1;
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, width, height);

  for (const layer of layers) {
    if (layer.alpha <= 0) continue;
    const image = await render(resolve(layer.scene), width, height, samples);
    ctx.globalAlpha = layer.alpha;
    ctx.drawImage(image, 0, 0);
  }

  ctx.globalAlpha = 1;
  if (vignette > 0) {
    const g = ctx.createRadialGradient(width / 2, height / 2, height * 0.35, width / 2, height / 2, Math.hypot(width, height) / 2);
    g.addColorStop(0, 'rgba(0,0,0,0)');
    g.addColorStop(1, `rgba(0,0,0,${vignette})`);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, width, height);
  }
  if (fade < 1) {
    ctx.fillStyle = `rgba(0,0,0,${1 - fade})`;
    ctx.fillRect(0, 0, width, height);
  }
  return compose.toDataURL('image/png');
}

function gpuInfo(): string {
  const gl = document.createElement('canvas').getContext('webgl2');
  const ext = gl?.getExtension('WEBGL_debug_renderer_info');
  return gl && ext ? String(gl.getParameter(ext.UNMASKED_RENDERER_WEBGL)) : gl ? 'WebGL2 (renderer hidden)' : 'no WebGL2';
}

Object.assign(window, { showreel: { frame, gpuInfo, ready: true } });
