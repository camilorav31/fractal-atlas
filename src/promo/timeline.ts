/**
 * Frame arithmetic for the promo film. Everything on screen is a pure
 * function of the frame number, so any frame can be rendered on its own, in
 * any order, and the film is perfectly reproducible.
 */

export const FPS = 30;
/** Design size in CSS px; renders are scaled from it. */
export const STAGE = { width: 1920, height: 1080 } as const;

const frames = (seconds: number) => Math.round(seconds * FPS);

export interface Span {
  start: number;
  end: number;
}

/** Back-to-back spans with the given durations, in seconds. */
function sequence<const D extends Record<string, number>>(durations: D): { [K in keyof D]: Span } {
  let cursor = 0;
  const out: Record<string, Span> = {};
  for (const [name, seconds] of Object.entries(durations)) {
    out[name] = { start: cursor, end: (cursor += frames(seconds)) };
  }
  return out as { [K in keyof D]: Span };
}

/** The film's five acts. */
export const ACTS = sequence({ intro: 2.0, families: 5.2, dive: 3.4, palettes: 2.0, outro: 2.4 });

export const TOTAL_FRAMES = ACTS.outro.end;

/** Act II is four equal chapters, one per fractal family. */
export const CHAPTER_COUNT = 4;
export const CHAPTER_FRAMES = (ACTS.families.end - ACTS.families.start) / CHAPTER_COUNT;

export const clamp01 = (t: number) => Math.min(1, Math.max(0, t));
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

/** Position of `frame` within [start, end], clamped to [0, 1]. */
export const progress = (frame: number, start: number, end: number) => clamp01((frame - start) / (end - start));

/** CSS-style cubic Bézier easing (Newton–Raphson on x, as browsers do). */
export function bezier(x1: number, y1: number, x2: number, y2: number): (t: number) => number {
  const axis = (a: number, b: number, s: number) => 3 * a * (1 - s) ** 2 * s + 3 * b * (1 - s) * s ** 2 + s ** 3;
  const slope = (a: number, b: number, s: number) => 3 * a * (1 - s) ** 2 + 6 * (b - a) * (1 - s) * s + 3 * (1 - b) * s ** 2;
  return (x) => {
    if (x <= 0 || x >= 1) return clamp01(x);
    let s = x;
    for (let i = 0; i < 8; i++) {
      const err = axis(x1, x2, s) - x;
      const d = slope(x1, x2, s);
      if (Math.abs(err) < 1e-6 || d === 0) break;
      s -= err / d;
    }
    return axis(y1, y2, clamp01(s));
  };
}

/** The app's own curves (--ease-out-expo, --ease-soft) plus two for camera moves. */
export const ease = {
  outExpo: bezier(0.16, 1, 0.3, 1),
  soft: bezier(0.2, 0.8, 0.2, 1),
  inOut: bezier(0.65, 0, 0.35, 1),
  inOutSine: (t: number) => -(Math.cos(Math.PI * clamp01(t)) - 1) / 2,
  outCubic: (t: number) => 1 - (1 - clamp01(t)) ** 3,
};

/** Deterministic pseudo-random in [0, 1) from an integer seed. */
export function hash(seed: number): number {
  let x = Math.imul(seed ^ 0x9e3779b9, 0x85ebca6b);
  x = Math.imul(x ^ (x >>> 13), 0xc2b2ae35);
  return ((x ^ (x >>> 16)) >>> 0) / 2 ** 32;
}
