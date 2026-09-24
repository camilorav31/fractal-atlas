import type { AffineMap } from '../types';

export const MIN_MAPS = 1;
export const MAX_MAPS = 8;
/** Coefficients are clamped so a typo can't send the attractor to infinity. */
export const COEFFICIENT_LIMIT = 10;

/** |det A|: the factor by which a map scales area. */
export const areaScale = (m: AffineMap) => Math.abs(m.a * m.d - m.b * m.c);

/**
 * Largest singular value of the linear part — the map's Lipschitz constant.
 * The chaos game converges to a unique attractor when every map is a
 * contraction (σ₁ < 1): that is Hutchinson's theorem.
 */
export function contractionFactor({ a, b, c, d }: AffineMap): number {
  const s1 = a * a + b * b + c * c + d * d;
  const det = a * d - b * c;
  const disc = Math.sqrt(Math.max(0, s1 * s1 - 4 * det * det));
  return Math.sqrt((s1 + disc) / 2);
}

export function nonContractive(maps: readonly AffineMap[]): number[] {
  return maps.flatMap((m, i) => (contractionFactor(m) >= 1 ? [i] : []));
}

/**
 * Probabilities proportional to each map's area scale — the classic
 * heuristic that gives every part of the attractor similar point density.
 * Degenerate maps (like the fern's stem, det = 0) get a small floor.
 */
export function balancedProbabilities(maps: readonly AffineMap[]): AffineMap[] {
  const weights = maps.map((m) => Math.max(areaScale(m), 0.01));
  const total = weights.reduce((sum, w) => sum + w, 0);
  return maps.map((m, i) => ({ ...m, p: round(weights[i]! / total, 4) }));
}

/** Probabilities rescaled to sum to 1 (all equal if they sum to 0). */
export function normalizedProbabilities(maps: readonly AffineMap[]): number[] {
  const ps = maps.map((m) => Math.max(0, m.p));
  const total = ps.reduce((sum, p) => sum + p, 0);
  return total > 0 ? ps.map((p) => p / total) : maps.map(() => 1 / maps.length);
}

const round = (v: number, digits: number) => Number(v.toFixed(digits));
const KEYS = ['a', 'b', 'c', 'd', 'e', 'f', 'p'] as const;

/** Compact URL form: "a,b,c,d,e,f,p;a,b,…" with up to 5 decimals. */
export function encodeMaps(maps: readonly AffineMap[]): string {
  return maps.map((m) => KEYS.map((k) => String(round(m[k], 5))).join(',')).join(';');
}

/** Parses and validates the URL form; returns null if anything is off. */
export function decodeMaps(text: string): AffineMap[] | null {
  const parts = text.split(';').filter(Boolean);
  if (parts.length < MIN_MAPS || parts.length > MAX_MAPS) return null;
  const maps: AffineMap[] = [];
  for (const part of parts) {
    const values = part.split(',').map(Number);
    if (values.length !== 7 || !values.every(Number.isFinite)) return null;
    const [a, b, c, d, e, f, p] = values.map((v) => Math.max(-COEFFICIENT_LIMIT, Math.min(COEFFICIENT_LIMIT, v))) as [
      number, number, number, number, number, number, number,
    ];
    maps.push({ a, b, c, d, e, f, p: Math.max(0, p) });
  }
  return maps;
}

/** Nudges every coefficient by up to ±`amount`, keeping the maps contractive. */
export function mutate(maps: readonly AffineMap[], random: () => number, amount = 0.06): AffineMap[] {
  return maps.map((m) => {
    for (let attempt = 0; attempt < 8; attempt++) {
      const jitter = (v: number, scale = 1) => round(v + (random() * 2 - 1) * amount * scale, 4);
      const next = { ...m, a: jitter(m.a), b: jitter(m.b), c: jitter(m.c), d: jitter(m.d), e: jitter(m.e, 4), f: jitter(m.f, 4) };
      if (contractionFactor(next) < 1) return next;
    }
    return m;
  });
}
