import type { IterationParams } from './types';

export const MIN_ITERATIONS = 32;
export const MAX_ITERATIONS = 20000;

export const DEFAULT_ITERATIONS: IterationParams = { maxIterations: 400, autoIterations: true };

/**
 * Deep views need longer orbits before points near the boundary escape.
 * Growing the budget linearly with zoom depth keeps detail without making
 * shallow views pay for iterations they don't need.
 */
export function scaledIterations(params: IterationParams, zoomLog: number): number {
  const base = params.maxIterations;
  const scaled = params.autoIterations ? base * (1 + 0.55 * Math.max(0, zoomLog)) : base;
  return Math.round(Math.min(MAX_ITERATIONS, Math.max(MIN_ITERATIONS, scaled)));
}
