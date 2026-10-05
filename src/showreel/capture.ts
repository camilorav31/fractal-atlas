import { gpuInfo, SceneRenderer, type SceneSpec } from './scenes';

/**
 * Showreel capture harness: renders frames through the app's own engines,
 * offscreen, with no UI. Driven frame by frame from Node (scripts/showreel.mjs)
 * so the video has a perfectly steady frame rate regardless of render time.
 */

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

const scenes = new SceneRenderer();
const compose = document.createElement('canvas');
const ctx = compose.getContext('2d')!;

async function frame({ layers, width, height, samples, vignette, fade }: FrameRequest): Promise<string> {
  compose.width = width;
  compose.height = height;
  ctx.globalAlpha = 1;
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, width, height);

  for (const layer of layers) {
    if (layer.alpha <= 0) continue;
    const image = await scenes.render(layer.scene, width, height, samples);
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

Object.assign(window, { showreel: { frame, gpuInfo, ready: true } });
