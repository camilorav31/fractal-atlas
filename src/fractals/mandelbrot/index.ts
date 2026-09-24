import fragmentShader from '../../shaders/mandelbrot.frag';
import type { EscapeTimeFractal } from '../definition';
import type { MandelbrotParams } from '../types';

export const MIN_ITERATIONS = 32;
export const MAX_ITERATIONS = 20000;

export const mandelbrotDefaults: MandelbrotParams = {
  maxIterations: 400,
  autoIterations: true,
};

/**
 * Deep views need longer orbits before points near the boundary escape.
 * Growing the budget linearly with zoom depth keeps detail without making
 * shallow views pay for iterations they don't need.
 */
export function mandelbrotIterations(params: MandelbrotParams, zoomLog: number): number {
  const base = params.maxIterations;
  const scaled = params.autoIterations ? base * (1 + 0.55 * Math.max(0, zoomLog)) : base;
  return Math.round(Math.min(MAX_ITERATIONS, Math.max(MIN_ITERATIONS, scaled)));
}

export const mandelbrot: EscapeTimeFractal<'mandelbrot'> = {
  kind: 'mandelbrot',
  title: 'Mandelbrot set',
  formula: 'zₙ₊₁ = zₙ² + c',
  fragmentShader,
  defaultParams: mandelbrotDefaults,
  defaultView: { centerX: -0.6, centerY: 0, zoomLog: 0 },
  effectiveIterations: mandelbrotIterations,
};
