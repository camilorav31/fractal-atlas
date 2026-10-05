import { SceneRenderer } from '../showreel/scenes';
import { shotAt, wipeAt, wipeEdge, type Layer, type Shot } from './shots';
import { STAGE } from './timeline';

export interface RenderSize {
  width: number;
  height: number;
  /** Supersamples per pixel for escape-time layers. */
  samples: number;
}

const VIGNETTE = 0.38;
/** Fast camera moves are where aliasing shimmers most, so a blurred shot gets this multiple of the nominal samples, split across its sub-frames. */
const BLUR_SAMPLE_BUDGET = 3;

/** Composites the film's fractal footage onto a canvas: shots, motion blur, palette crossfades and wipes. */
export class Backdrop {
  readonly scenes = new SceneRenderer();

  constructor(private readonly canvas: HTMLCanvasElement) {}

  async draw(frame: number, size: RenderSize): Promise<void> {
    const { canvas } = this;
    canvas.width = size.width;
    canvas.height = size.height;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, size.width, size.height);

    const wipe = wipeAt(frame);
    if (wipe) {
      ctx.drawImage(await this.shot(wipe.from, frame - wipe.from.span.start, size), 0, 0);
      const incoming = await this.shot(wipe.to, frame - wipe.to.span.start, size);
      // Reveal the incoming shot behind the slanted edge as it sweeps left to right.
      const scale = size.width / STAGE.width;
      const { top, bottom } = wipeEdge(wipe.progress);
      ctx.save();
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(top * scale, 0);
      ctx.lineTo(bottom * scale, size.height);
      ctx.lineTo(0, size.height);
      ctx.closePath();
      ctx.clip();
      ctx.drawImage(incoming, 0, 0);
      ctx.restore();
    } else {
      const { shot } = shotAt(frame);
      ctx.drawImage(await this.shot(shot, frame - shot.span.start, size), 0, 0);
    }

    const g = ctx.createRadialGradient(size.width / 2, size.height / 2, size.height * 0.35, size.width / 2, size.height / 2, Math.hypot(size.width, size.height) / 2);
    g.addColorStop(0, 'rgba(0,0,0,0)');
    g.addColorStop(1, `rgba(0,0,0,${VIGNETTE})`);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, size.width, size.height);
  }

  /** One shot at `local` frames in, with its motion blur: sub-frames averaged by 1/k blending. */
  private async shot(shot: Shot, local: number, size: RenderSize): Promise<HTMLCanvasElement> {
    const { samples: subframes, shutter } = shot.blur ?? { samples: 1, shutter: 0 };
    if (subframes === 1) return this.composite(shot.layers(local), size);
    const sub = { ...size, samples: Math.max(1, Math.ceil((size.samples * BLUR_SAMPLE_BUDGET) / subframes)) };
    const { canvas, ctx } = surface(size);
    for (let k = 0; k < subframes; k++) {
      const offset = (k / (subframes - 1) - 0.5) * shutter;
      ctx.globalAlpha = 1 / (k + 1);
      ctx.drawImage(await this.composite(shot.layers(local + offset), sub), 0, 0);
    }
    return canvas;
  }

  private async composite(layers: Layer[], size: RenderSize): Promise<HTMLCanvasElement> {
    const [first, ...rest] = layers;
    const base = await this.scenes.render(first!.scene, size.width, size.height, size.samples);
    if (rest.length === 0) return base;
    const { canvas, ctx } = surface(size);
    ctx.drawImage(base, 0, 0);
    for (const layer of rest) {
      ctx.globalAlpha = layer.alpha;
      ctx.drawImage(await this.scenes.render(layer.scene, size.width, size.height, size.samples), 0, 0);
    }
    return canvas;
  }
}

function surface({ width, height }: RenderSize) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  return { canvas, ctx: canvas.getContext('2d')! };
}
