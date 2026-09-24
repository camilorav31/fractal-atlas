import { describe, expect, it } from 'vitest';
import {
  MAX_ZOOM_LOG,
  frameInSafeArea,
  needsDoublePrecision,
  panBy,
  pixelSize,
  screenToComplex,
  splitDouble,
  zoomAround,
} from './viewMath';

const view = { centerX: -0.75, centerY: 0.1, zoomLog: 2 };
const W = 1600;
const H = 900;

describe('screenToComplex', () => {
  it('maps the viewport centre to the view centre', () => {
    expect(screenToComplex(view, W / 2, H / 2, W, H)).toEqual({ x: -0.75, y: 0.1 });
  });

  it('flips the y axis (screen down = imaginary down)', () => {
    const below = screenToComplex(view, W / 2, H / 2 + 10, W, H);
    expect(below.y).toBeLessThan(view.centerY);
  });
});

describe('zoomAround', () => {
  it('keeps the complex point under the cursor fixed', () => {
    const [sx, sy] = [1234, 210];
    const before = screenToComplex(view, sx, sy, W, H);
    const zoomed = zoomAround(view, sx, sy, W, H, 7.5);
    const after = screenToComplex(zoomed, sx, sy, W, H);
    expect(after.x).toBeCloseTo(before.x, 12);
    expect(after.y).toBeCloseTo(before.y, 12);
  });

  it('clamps to the supported depth', () => {
    expect(zoomAround(view, 0, 0, W, H, 99).zoomLog).toBe(MAX_ZOOM_LOG);
  });
});

describe('panBy', () => {
  it('moves the image with the pointer', () => {
    const panned = panBy(view, 100, 0, H);
    // Dragging right reveals what was to the left: the centre moves left.
    expect(panned.centerX).toBeCloseTo(view.centerX - 100 * pixelSize(view.zoomLog, H), 15);
  });
});

describe('splitDouble', () => {
  it('produces float32 halves whose sum recovers ~48 bits', () => {
    const x = -0.7436438870371587;
    const [hi, lo] = splitDouble(x);
    expect(Math.fround(hi)).toBe(hi);
    expect(Math.fround(lo)).toBe(lo);
    expect(Math.abs(hi + lo - x)).toBeLessThan(Math.abs(x) * 2 ** -46);
    expect(Math.abs(hi - x)).toBeGreaterThan(0); // float32 alone would lose precision
  });
});

describe('needsDoublePrecision', () => {
  it('uses float32 for shallow views and df64 for deep ones', () => {
    expect(needsDoublePrecision({ ...view, zoomLog: 0 }, H)).toBe(false);
    expect(needsDoublePrecision({ ...view, zoomLog: 6 }, H)).toBe(true);
  });
});

describe('frameInSafeArea', () => {
  it('shifts the centre so content sits in the middle of the free area', () => {
    const framed = frameInSafeArea({ centerX: 0, centerY: 0, zoomLog: 0 }, W, H, { right: 400, bottom: 0 });
    const freeCentre = screenToComplex(framed, (W - 400) / 2, H / 2, W, H);
    expect(freeCentre.x).toBeCloseTo(0, 12);
    expect(freeCentre.y).toBeCloseTo(0, 12);
  });

  it('zooms out when the free area is too narrow', () => {
    const framed = frameInSafeArea({ centerX: 0, centerY: 0, zoomLog: 0 }, 900, 900, { right: 400, bottom: 0 });
    expect(framed.zoomLog).toBeLessThan(0);
  });
});
