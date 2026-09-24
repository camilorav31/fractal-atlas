import { describe, expect, it } from 'vitest';
import { BASE_SPAN } from '../../utils/viewMath';
import type { LSystemParams } from '../types';
import {
  MAX_SEGMENTS,
  estimateSegments,
  formatRules,
  maxIterationsWithinBudget,
  parseRules,
  validateAxiom,
} from './grammar';
import { LSYSTEM_PRESETS, findPreset, paramsFromPreset } from './presets';
import { buildGeometry } from './turtle';

const rulesOf = (text: string) => {
  const parsed = parseRules(text);
  if (!parsed.ok) throw new Error(parsed.error);
  return parsed.rules;
};

const koch = (overrides: Partial<LSystemParams> = {}): LSystemParams => ({
  ...paramsFromPreset(findPreset('snowflake')!),
  ...overrides,
});

describe('grammar', () => {
  it('parses rules in several notations', () => {
    const rules = rulesOf('X = F+[[X]-X]-F[-FX]+X ; F→FF\nY->−F');
    expect(rules.get('X')).toBe('F+[[X]-X]-F[-FX]+X');
    expect(rules.get('F')).toBe('FF');
    expect(rules.get('Y')).toBe('-F'); // typographic minus normalized
    expect(formatRules(rules)).toBe('X=F+[[X]-X]-F[-FX]+X\nF=FF\nY=-F');
  });

  it('reports actionable errors', () => {
    expect(parseRules('F=F?F')).toMatchObject({ ok: false, error: expect.stringContaining('“?”') });
    expect(parseRules('F=F\nF=FF')).toMatchObject({ ok: false, error: expect.stringContaining('two rules') });
    expect(parseRules('nonsense')).toMatchObject({ ok: false });
    expect(parseRules('')).toMatchObject({ ok: false });
    expect(validateAxiom('')).not.toBeNull();
    expect(validateAxiom('F--F--F')).toBeNull();
  });

  it('estimates segment counts without expanding the string', () => {
    // Koch: each F becomes 4 Fs.
    expect(estimateSegments('F', rulesOf('F=F+F--F+F'), 5)).toBe(4 ** 5);
    // Variables (X) are rewritten but never drawn.
    expect(estimateSegments('X', rulesOf('X=F[+X]F[-X]+X\nF=FF'), 0)).toBe(0);
  });

  it('matches the turtle’s real output for every preset', () => {
    for (const preset of LSYSTEM_PRESETS) {
      const params = paramsFromPreset(preset);
      const expected = estimateSegments(params.axiom, rulesOf(params.rules), params.iterations);
      expect(buildGeometry(params).count, preset.id).toBe(expected);
    }
  });

  it('finds the largest iteration count within budget', () => {
    const rules = rulesOf('F=FFFF');
    const n = maxIterationsWithinBudget('F', rules);
    expect(4 ** n).toBeLessThanOrEqual(MAX_SEGMENTS);
    expect(4 ** (n + 1)).toBeGreaterThan(MAX_SEGMENTS);
  });
});

describe('turtle geometry', () => {
  it('closes the Koch snowflake', () => {
    const g = buildGeometry(koch({ iterations: 3 }));
    const first = [g.segments[0], g.segments[1]];
    const last = [g.segments[g.count * 4 - 2], g.segments[g.count * 4 - 1]];
    expect(last[0]).toBeCloseTo(first[0]!, 4);
    expect(last[1]).toBeCloseTo(first[1]!, 4);
  });

  it('normalizes the figure to fit the default view, centred', () => {
    const g = buildGeometry(koch({ iterations: 4 }));
    let minY = Infinity, maxY = -Infinity, minX = Infinity, maxX = -Infinity;
    for (let i = 0; i < g.count * 4; i += 2) {
      minX = Math.min(minX, g.segments[i]!); maxX = Math.max(maxX, g.segments[i]!);
      minY = Math.min(minY, g.segments[i + 1]!); maxY = Math.max(maxY, g.segments[i + 1]!);
    }
    expect(maxY - minY).toBeLessThanOrEqual(BASE_SPAN);
    expect((minX + maxX) / 2).toBeCloseTo(0, 5);
    expect((minY + maxY) / 2).toBeCloseTo(0, 5);
  });

  it('tracks branch depth for bracketed systems', () => {
    const g = buildGeometry(paramsFromPreset(findPreset('tree')!));
    expect(g.maxDepth).toBeGreaterThan(3);
    expect(g.depth[0]).toBe(0); // the trunk
  });

  it('is deterministic for a seed and varies across seeds', () => {
    const plant = paramsFromPreset(findPreset('plant')!);
    const a = buildGeometry({ ...plant, iterations: 4, jitter: 0.5, seed: 1 });
    const b = buildGeometry({ ...plant, iterations: 4, jitter: 0.5, seed: 1 });
    const c = buildGeometry({ ...plant, iterations: 4, jitter: 0.5, seed: 2 });
    expect(a.segments).toEqual(b.segments);
    expect(a.segments).not.toEqual(c.segments);
  });

  it('stops at the segment budget instead of running away', () => {
    const g = buildGeometry(koch({ axiom: 'F', rules: 'F=FFFFFFFF', iterations: 9 }));
    expect(g.count).toBe(MAX_SEGMENTS);
    expect(g.truncated).toBe(true);
  });
});
