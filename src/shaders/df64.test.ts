import { describe, expect, it } from 'vitest';

/**
 * A float32 emulation of the error-free transforms in lib/df64.glsl.
 * Math.fround rounds after every operation, exactly like an IEEE-conformant
 * GPU. These tests pin down the maths the shader relies on; the in-browser
 * fast-math guard is covered by the `opaque()` barrier in the shader itself.
 */
const f = Math.fround;

function twoSum(a: number, b: number): [number, number] {
  const s = f(a + b);
  const v = f(s - a);
  return [s, f(f(a - f(s - v)) + f(b - v))];
}

function quickTwoSum(a: number, b: number): [number, number] {
  const s = f(a + b);
  return [s, f(b - f(s - a))];
}

function split(a: number): [number, number] {
  const t = f(a * 4097);
  const hi = f(t - f(t - a));
  return [hi, f(a - hi)];
}

function twoProd(a: number, b: number): [number, number] {
  const p = f(a * b);
  const [ah, al] = split(a);
  const [bh, bl] = split(b);
  let e = f(f(ah * bh) - p);
  e = f(e + f(ah * bl));
  e = f(e + f(al * bh));
  return [p, f(e + f(al * bl))];
}

function dfAdd(a: [number, number], b: [number, number]): [number, number] {
  let s = twoSum(a[0], b[0]);
  const t = twoSum(a[1], b[1]);
  s = quickTwoSum(s[0], f(s[1] + t[0]));
  return quickTwoSum(s[0], f(s[1] + t[1]));
}

const toDf = (x: number): [number, number] => {
  const hi = f(x);
  return [hi, f(x - hi)];
};

describe('df64 error-free transforms', () => {
  const samples = Array.from({ length: 200 }, (_, i) => f(Math.sin(i * 12.9898) * 3));

  it('two-sum is exact', () => {
    for (let i = 1; i < samples.length; i++) {
      const [a, b] = [samples[i - 1]!, f(samples[i]! * 1e-5)];
      const [s, e] = twoSum(a, b);
      expect(s + e).toBe(a + b); // float64 addition of two float32 is exact here
    }
  });

  it('Dekker product is exact', () => {
    for (let i = 1; i < samples.length; i++) {
      const [a, b] = [samples[i - 1]!, samples[i]!];
      const [p, e] = twoProd(a, b);
      expect(p + e).toBe(a * b);
    }
  });

  it('df64 addition keeps ~48 bits where float32 keeps 24', () => {
    const a = -0.7436438870371587;
    const b = 1.2345678e-9;
    const [hi, lo] = dfAdd(toDf(a), toDf(b));
    const dfError = Math.abs(hi + lo - (a + b));
    const f32Error = Math.abs(f(f(a) + f(b)) - (a + b));
    expect(dfError).toBeLessThan(1e-15);
    expect(f32Error).toBeGreaterThan(1e-9);
  });
});
