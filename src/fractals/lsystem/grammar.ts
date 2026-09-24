/**
 * L-system grammar: parsing, validation and size estimation.
 *
 * Turtle alphabet (after Prusinkiewicz & Lindenmayer, *The Algorithmic
 * Beauty of Plants*):
 *
 *   F G A B   move forward and draw a segment
 *   f         move forward without drawing
 *   + −       turn left / right by the angle
 *   |         turn around (180°)
 *   [ ]       push / pop the turtle state (position, heading, depth)
 *   other     letters are variables: rewritten, but ignored when drawing
 */

export const DRAW_SYMBOLS = new Set(['F', 'G', 'A', 'B']);
const TURTLE_SYMBOLS = new Set(['f', '+', '-', '|', '[', ']']);

/** Hard cap on drawn segments: keeps memory (~24 B/segment) and raster time bounded. */
export const MAX_SEGMENTS = 1_200_000;
export const MAX_LSYSTEM_ITERATIONS = 16;
export const MAX_GRAMMAR_LENGTH = 240;

export type Rules = ReadonlyMap<string, string>;

export type ParseResult = { ok: true; rules: Rules } | { ok: false; error: string };

const isSymbol = (ch: string) => /^[A-Za-z]$/.test(ch) || TURTLE_SYMBOLS.has(ch);

/** Normalizes typographic minus signs and strips whitespace inside a word. */
export const normalizeWord = (word: string) => word.replace(/[−–]/g, '-').replace(/\s+/g, '');

export function validateAxiom(axiom: string): string | null {
  const word = normalizeWord(axiom);
  if (word.length === 0) return 'The axiom is empty.';
  if (word.length > MAX_GRAMMAR_LENGTH) return 'The axiom is too long.';
  const bad = [...word].find((ch) => !isSymbol(ch));
  return bad ? `Unknown symbol “${bad}” in the axiom.` : null;
}

/**
 * Parses rules written one per line (or separated by `;`) as `X=…` or `X→…`.
 * Only letters may be rewritten; turtle commands are fixed.
 */
export function parseRules(text: string): ParseResult {
  if (text.length > MAX_GRAMMAR_LENGTH * 4) return { ok: false, error: 'The rules are too long.' };
  const rules = new Map<string, string>();
  const lines = text.split(/[\n;]/).map((l) => l.trim()).filter(Boolean);
  for (const line of lines) {
    const match = /^([A-Za-z])\s*(?:=|→|->)\s*(.*)$/.exec(line);
    if (!match) return { ok: false, error: `Can’t read “${line}”. Write rules as X=…` };
    const [, symbol, rawBody] = match as unknown as [string, string, string];
    const body = normalizeWord(rawBody);
    if (rules.has(symbol)) return { ok: false, error: `“${symbol}” has two rules.` };
    const bad = [...body].find((ch) => !isSymbol(ch));
    if (bad) return { ok: false, error: `Unknown symbol “${bad}” in the rule for ${symbol}.` };
    rules.set(symbol, body);
  }
  if (rules.size === 0) return { ok: false, error: 'Add at least one rule.' };
  return { ok: true, rules };
}

/** Serializes rules back to the canonical one-per-line form. */
export function formatRules(rules: Rules): string {
  return [...rules].map(([symbol, body]) => `${symbol}=${body}`).join('\n');
}

/**
 * Number of drawn segments after `iterations` rewrites, computed from symbol
 * counts alone — O(iterations × alphabet²) instead of expanding a string that
 * can grow to millions of characters.
 */
export function estimateSegments(axiom: string, rules: Rules, iterations: number): number {
  let counts = new Map<string, number>();
  for (const ch of normalizeWord(axiom)) counts.set(ch, (counts.get(ch) ?? 0) + 1);

  for (let i = 0; i < iterations; i++) {
    const next = new Map<string, number>();
    for (const [symbol, count] of counts) {
      const body = rules.get(symbol);
      if (body === undefined) {
        next.set(symbol, (next.get(symbol) ?? 0) + count);
        continue;
      }
      for (const ch of body) next.set(ch, (next.get(ch) ?? 0) + count);
    }
    counts = next;
    // Stop early once the budget is clearly exceeded (and before overflow).
    if (drawCount(counts) > MAX_SEGMENTS * 16) return Infinity;
  }
  return drawCount(counts);
}

function drawCount(counts: Map<string, number>): number {
  let total = 0;
  for (const [symbol, count] of counts) if (DRAW_SYMBOLS.has(symbol)) total += count;
  return total;
}

/** The largest iteration count whose output fits the segment budget. */
export function maxIterationsWithinBudget(axiom: string, rules: Rules): number {
  let n = 0;
  while (n < MAX_LSYSTEM_ITERATIONS && estimateSegments(axiom, rules, n + 1) <= MAX_SEGMENTS) n++;
  return n;
}
