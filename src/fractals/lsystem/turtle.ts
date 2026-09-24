import { BASE_SPAN } from '../../utils/viewMath';
import type { LSystemParams } from '../types';
import { DRAW_SYMBOLS, MAX_SEGMENTS, estimateSegments, normalizeWord, parseRules, type Rules } from './grammar';
import { mulberry32 } from './random';

/** Drawn geometry, normalized so the whole figure fits the default view. */
export interface Geometry {
  /** x0, y0, x1, y1 per segment, in drawing order. */
  segments: Float32Array;
  /** Branch depth (bracket nesting) per segment. */
  depth: Uint8Array;
  count: number;
  maxDepth: number;
  /** True when the segment budget cut the figure short. */
  truncated: boolean;
}

/** Fraction of the default view's height the figure occupies. */
const FIT = 0.84;
/** Width/height the figure is fitted into, so wide curves aren't clipped. */
const FIT_ASPECT = 1.5;

interface TurtleState {
  x: number;
  y: number;
  heading: number; // radians
  depth: number;
}

/**
 * Expands the grammar and walks the turtle in one pass. Rewriting is done
 * recursively — a symbol at depth n expands straight into its rule at depth
 * n − 1 — so the full string (which can reach millions of characters) is
 * never materialized.
 */
export function buildGeometry(params: LSystemParams): Geometry {
  const parsed = parseRules(params.rules);
  const rules: Rules = parsed.ok ? parsed.rules : new Map();
  const axiom = normalizeWord(params.axiom);
  const estimate = estimateSegments(axiom, rules, params.iterations);
  const capacity = Math.max(1, Math.min(MAX_SEGMENTS, Number.isFinite(estimate) ? estimate : MAX_SEGMENTS));

  const segments = new Float32Array(capacity * 4);
  const depth = new Uint8Array(capacity);
  const random = mulberry32(params.seed);
  const turn = (params.angle * Math.PI) / 180;
  const jitter = params.jitter;

  let count = 0;
  let maxDepth = 0;
  let truncated = false;
  let turtle: TurtleState = { x: 0, y: 0, heading: (params.heading * Math.PI) / 180, depth: 0 };
  const stack: TurtleState[] = [];
  let minX = 0, maxX = 0, minY = 0, maxY = 0;

  // Seeded variation: ±50% of the angle and ±30% of the step at jitter = 1.
  const turnBy = (sign: number) => sign * turn * (1 + (random() * 2 - 1) * jitter * 0.5);
  const stepLength = () => 1 + (random() * 2 - 1) * jitter * 0.3;

  const act = (ch: string) => {
    if (DRAW_SYMBOLS.has(ch) || ch === 'f') {
      const len = jitter > 0 ? stepLength() : 1;
      const nx = turtle.x + Math.cos(turtle.heading) * len;
      const ny = turtle.y + Math.sin(turtle.heading) * len;
      if (ch !== 'f') {
        if (count >= capacity) {
          truncated = true;
          return;
        }
        const o = count * 4;
        segments[o] = turtle.x;
        segments[o + 1] = turtle.y;
        segments[o + 2] = nx;
        segments[o + 3] = ny;
        depth[count] = Math.min(255, turtle.depth);
        count++;
        minX = Math.min(minX, nx); maxX = Math.max(maxX, nx);
        minY = Math.min(minY, ny); maxY = Math.max(maxY, ny);
      }
      turtle.x = nx;
      turtle.y = ny;
    } else if (ch === '+') turtle.heading += turnBy(1);
    else if (ch === '-') turtle.heading += turnBy(-1);
    else if (ch === '|') turtle.heading += Math.PI;
    else if (ch === '[') {
      stack.push({ ...turtle });
      turtle.depth++;
      maxDepth = Math.max(maxDepth, turtle.depth);
    } else if (ch === ']') {
      turtle = stack.pop() ?? turtle;
    }
  };

  const expand = (word: string, level: number) => {
    for (const ch of word) {
      if (truncated) return;
      const body = level > 0 ? rules.get(ch) : undefined;
      if (body !== undefined) expand(body, level - 1);
      else act(ch);
    }
  };
  expand(axiom, params.iterations);

  normalize(segments, count, { minX, maxX, minY, maxY });
  return { segments, depth, count, maxDepth, truncated };
}

/** Centres the figure on the origin and scales it to fit the default view. */
function normalize(
  segments: Float32Array,
  count: number,
  b: { minX: number; maxX: number; minY: number; maxY: number },
): void {
  const width = b.maxX - b.minX;
  const height = b.maxY - b.minY;
  const extent = Math.max(height, width / FIT_ASPECT, 1e-9);
  const scale = (BASE_SPAN * FIT) / extent;
  const cx = (b.minX + b.maxX) / 2;
  const cy = (b.minY + b.maxY) / 2;
  for (let i = 0; i < count * 4; i += 2) {
    segments[i] = (segments[i]! - cx) * scale;
    segments[i + 1] = (segments[i + 1]! - cy) * scale;
  }
}
