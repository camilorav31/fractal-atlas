import type { ComplexView } from '../fractals/types';

/** Height of the visible region of the complex plane at zoomLog = 0. */
export const BASE_SPAN = 3.2;
export const MIN_ZOOM_LOG = -0.5;
/** Beyond ~1e13 even df64 runs out of mantissa bits and pixels turn blocky. */
export const MAX_ZOOM_LOG = 13;

export const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

/** Complex-plane units covered by one pixel of a viewport `heightPx` tall. */
export function pixelSize(zoomLog: number, heightPx: number): number {
  return BASE_SPAN / (10 ** zoomLog * heightPx);
}

/** Maps a screen point (CSS px, y down) to the complex plane (y up). */
export function screenToComplex(
  view: ComplexView,
  sx: number,
  sy: number,
  width: number,
  height: number,
): { x: number; y: number } {
  const ps = pixelSize(view.zoomLog, height);
  return {
    x: view.centerX + (sx - width / 2) * ps,
    y: view.centerY - (sy - height / 2) * ps,
  };
}

/** Inverse of `screenToComplex`: complex point → screen position (CSS px). */
export function complexToScreen(
  view: ComplexView,
  x: number,
  y: number,
  width: number,
  height: number,
): { sx: number; sy: number } {
  const ps = pixelSize(view.zoomLog, height);
  return { sx: (x - view.centerX) / ps + width / 2, sy: (view.centerY - y) / ps + height / 2 };
}

/**
 * Returns a view at `zoomLog` in which the complex point currently under the
 * screen position (sx, sy) stays under that same position.
 */
export function zoomAround(
  view: ComplexView,
  sx: number,
  sy: number,
  width: number,
  height: number,
  zoomLog: number,
): ComplexView {
  const nextZoom = clamp(zoomLog, MIN_ZOOM_LOG, MAX_ZOOM_LOG);
  const anchor = screenToComplex(view, sx, sy, width, height);
  const ps = pixelSize(nextZoom, height);
  return {
    centerX: anchor.x - (sx - width / 2) * ps,
    centerY: anchor.y + (sy - height / 2) * ps,
    zoomLog: nextZoom,
  };
}

/** Pans by a screen-space delta (CSS px). Dragging right moves the image right. */
export function panBy(view: ComplexView, dx: number, dy: number, height: number): ComplexView {
  const ps = pixelSize(view.zoomLog, height);
  return { ...view, centerX: view.centerX - dx * ps, centerY: view.centerY + dy * ps };
}

/**
 * Splits a float64 into the (hi, lo) float32 pair consumed by the df64 shader
 * code: hi is the nearest float32, lo the float32 nearest to the remainder.
 */
export function splitDouble(value: number): [hi: number, lo: number] {
  const hi = Math.fround(value);
  return [hi, Math.fround(value - hi)];
}

/**
 * float32 carries ~7 significant digits; orbit iteration amplifies rounding
 * error, so switch to df64 well before a pixel reaches float epsilon.
 */
export function needsDoublePrecision(view: ComplexView, heightPx: number): boolean {
  const magnitude = Math.max(1, Math.abs(view.centerX), Math.abs(view.centerY));
  return pixelSize(view.zoomLog, heightPx) / magnitude < 2e-6;
}

export interface Insets {
  right: number;
  bottom: number;
}

/**
 * Re-frames `view` so its centre lands in the middle of the part of the
 * viewport not covered by UI (the side panel on desktop, the sheet on mobile),
 * zooming out when that area is narrower than `minAspect`.
 */
export function frameInSafeArea(
  view: ComplexView,
  width: number,
  height: number,
  insets: Insets,
  minAspect = 1.2,
): ComplexView {
  const freeW = Math.max(1, width - insets.right);
  const freeH = Math.max(1, height - insets.bottom);
  // Content spans the full height at `view.zoomLog`; shrink it to fit both free dimensions.
  const fit = Math.min(1, freeH / height, freeW / (height * minAspect));
  const zoomLog = clamp(view.zoomLog + Math.log10(fit), MIN_ZOOM_LOG, MAX_ZOOM_LOG);
  const ps = pixelSize(zoomLog, height);
  return {
    centerX: view.centerX + (insets.right / 2) * ps,
    centerY: view.centerY - (insets.bottom / 2) * ps,
    zoomLog,
  };
}
