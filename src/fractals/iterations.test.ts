import { describe, expect, it } from 'vitest';
import { MAX_ITERATIONS, scaledIterations } from './iterations';
import { bindFractal, defaultFractalState, withIteration } from './registry';

describe('scaledIterations', () => {
  it('uses the base budget when auto-scaling is off', () => {
    expect(scaledIterations({ maxIterations: 500, autoIterations: false }, 10)).toBe(500);
  });

  it('grows with depth when auto-scaling is on', () => {
    const shallow = scaledIterations({ maxIterations: 400, autoIterations: true }, 0);
    const deep = scaledIterations({ maxIterations: 400, autoIterations: true }, 10);
    expect(shallow).toBe(400);
    expect(deep).toBeGreaterThan(shallow * 5);
  });

  it('never exceeds the shader cap', () => {
    expect(scaledIterations({ maxIterations: 20000, autoIterations: true }, 13)).toBe(MAX_ITERATIONS);
  });
});

describe('registry', () => {
  it('carries iteration settings across a fractal switch', () => {
    const julia = defaultFractalState('julia', { maxIterations: 900, autoIterations: false });
    expect(julia).toMatchObject({ kind: 'julia', params: { maxIterations: 900, autoIterations: false } });
    expect(julia.kind === 'julia' && typeof julia.params.cRe).toBe('number');
  });

  it('patches iteration settings without touching kind-specific params', () => {
    const patched = withIteration(defaultFractalState('julia'), { maxIterations: 64 });
    expect(patched.kind === 'julia' && patched.params.cIm).toBe(0.156);
    expect(patched.params.maxIterations).toBe(64);
  });

  it('binds definitions to their own parameters', () => {
    expect(bindFractal(defaultFractalState('julia')).definition.kind).toBe('julia');
    expect(bindFractal(defaultFractalState('mandelbrot')).iterations(0)).toBe(400);
  });
});
