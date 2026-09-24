import type { ColorSettings, ComplexView } from '../types';
import { liftLightness, rasterizeGradient } from '../../utils/color';
import { pixelSize } from '../../utils/viewMath';
import type { Geometry } from './turtle';

export interface StrokeStyle {
  colorBy: 'path' | 'depth';
  /** px per 1000 px of image height. */
  lineWidth: number;
  taper: number;
  glow: number;
}

/** Colour quantization: strokes are batched into one path per (colour, width) pair. */
const COLOR_BUCKETS = 96;
const WIDTH_LEVELS = 6;
/** Below this, strokes fade instead of thinning, which reads better than hairline aliasing. */
const MIN_WIDTH_PX = 0.6;
/** Stroke widths are computed as if the image were at least this tall. */
const MIN_REFERENCE_HEIGHT = 600;
/** Palettes are built to rise out of black; strokes need every colour to read on the background. */
const MIN_STROKE_LIGHTNESS = 0.5;

type Context2D = OffscreenCanvasRenderingContext2D | CanvasRenderingContext2D;

/**
 * Draws `geometry` as seen through `view` into a `width × height` context.
 *
 * Drawing a million segments one `stroke()` at a time is far too slow, so
 * segments are bucketed by quantized colour and stroke width into Path2D
 * objects and each bucket is stroked once — about 500 draw calls regardless
 * of segment count. Off-screen segments are culled.
 */
export function rasterize(
  ctx: Context2D,
  geometry: Geometry,
  view: ComplexView,
  width: number,
  height: number,
  color: Pick<ColorSettings, 'density' | 'offset' | 'interior'>,
  stops: readonly string[],
  style: StrokeStyle,
): void {
  ctx.globalCompositeOperation = 'source-over';
  ctx.fillStyle = color.interior;
  ctx.fillRect(0, 0, width, height);
  if (geometry.count === 0) return;

  const ps = pixelSize(view.zoomLog, height);
  const halfW = width / 2;
  const halfH = height / 2;
  // Widths scale with image height so exports match the screen — but never
  // below a 600 px reference, or thumbnails would dissolve into hairlines.
  const basePx = (style.lineWidth * Math.max(height, MIN_REFERENCE_HEIGHT)) / 1000;
  // Each branch level thins the stroke; taper = 1 halves it per level.
  const thinning = 1 - 0.5 * style.taper;
  const levelOf = (depth: number) =>
    geometry.maxDepth === 0 ? 0 : Math.min(WIDTH_LEVELS - 1, Math.floor((depth / (geometry.maxDepth + 1)) * WIDTH_LEVELS));
  const levelWidth = Array.from({ length: WIDTH_LEVELS }, (_, level) => {
    const representativeDepth = ((level + 0.5) / WIDTH_LEVELS) * (geometry.maxDepth + 1);
    return basePx * thinning ** representativeDepth;
  });

  const palette = paletteColors(stops);
  const paths = new Map<number, Path2D>();
  const { segments, depth, count } = geometry;
  const pad = basePx * 4;

  for (let i = 0; i < count; i++) {
    const o = i * 4;
    const x0 = (segments[o]! - view.centerX) / ps + halfW;
    const y0 = (view.centerY - segments[o + 1]!) / ps + halfH;
    const x1 = (segments[o + 2]! - view.centerX) / ps + halfW;
    const y1 = (view.centerY - segments[o + 3]!) / ps + halfH;
    if (
      (x0 < -pad && x1 < -pad) || (x0 > width + pad && x1 > width + pad) ||
      (y0 < -pad && y1 < -pad) || (y0 > height + pad && y1 > height + pad)
    ) continue;

    const t = style.colorBy === 'path' ? i / count : depth[i]! / Math.max(1, geometry.maxDepth);
    const phase = t * color.density + color.offset;
    const bucket = Math.floor((phase - Math.floor(phase)) * COLOR_BUCKETS) % COLOR_BUCKETS;
    const key = bucket * WIDTH_LEVELS + levelOf(depth[i]!);
    let path = paths.get(key);
    if (!path) paths.set(key, (path = new Path2D()));
    path.moveTo(x0, y0);
    path.lineTo(x1, y1);
  }

  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  const strokeAll = (widthScale: number, widthAdd: number, alpha: number) => {
    for (const [key, path] of paths) {
      const w = levelWidth[key % WIDTH_LEVELS]!;
      const fade = w < MIN_WIDTH_PX ? w / MIN_WIDTH_PX : 1;
      ctx.globalAlpha = alpha * fade;
      ctx.strokeStyle = palette[Math.floor(key / WIDTH_LEVELS)]!;
      ctx.lineWidth = Math.max(MIN_WIDTH_PX, w) * widthScale + widthAdd;
      ctx.stroke(path);
    }
  };

  if (style.glow > 0) {
    // Soft additive halo first, so the crisp stroke sits on top of it.
    ctx.globalCompositeOperation = 'lighter';
    strokeAll(5, basePx * 2, 0.07 * style.glow);
    strokeAll(2.2, basePx, 0.12 * style.glow);
    ctx.globalCompositeOperation = 'source-over';
  }
  strokeAll(1, 0, 1);
  ctx.globalAlpha = 1;
}

/** Samples the cyclic palette at each bucket centre as CSS colours, lifted to stay legible. */
function paletteColors(stops: readonly string[]): string[] {
  const texels = rasterizeGradient(stops, COLOR_BUCKETS);
  return Array.from({ length: COLOR_BUCKETS }, (_, i) => {
    const o = i * 4;
    const rgb = liftLightness([texels[o]! / 255, texels[o + 1]! / 255, texels[o + 2]! / 255], MIN_STROKE_LIGHTNESS);
    const [r, g, b] = rgb.map((c) => Math.round(c * 255));
    return `rgb(${r} ${g} ${b})`;
  });
}
