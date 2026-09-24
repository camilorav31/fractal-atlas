import { describe, expect, it } from 'vitest';
import { MAX_ITERATIONS, mandelbrotIterations } from '.';

describe('mandelbrotIterations', () => {
  it('uses the base budget when auto-scaling is off', () => {
    expect(mandelbrotIterations({ maxIterations: 500, autoIterations: false }, 10)).toBe(500);
  });

  it('grows with depth when auto-scaling is on', () => {
    const shallow = mandelbrotIterations({ maxIterations: 400, autoIterations: true }, 0);
    const deep = mandelbrotIterations({ maxIterations: 400, autoIterations: true }, 10);
    expect(shallow).toBe(400);
    expect(deep).toBeGreaterThan(shallow * 5);
  });

  it('never exceeds the shader cap', () => {
    expect(mandelbrotIterations({ maxIterations: 20000, autoIterations: true }, 13)).toBe(MAX_ITERATIONS);
  });
});
