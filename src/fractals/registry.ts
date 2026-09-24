import type { BoundFractal, EscapeTimeFractal, ParamsOf } from './definition';
import type { FractalKind, FractalState, IterationParams } from './types';
import { julia } from './julia';
import { mandelbrot } from './mandelbrot';

/** Registered fractals, keyed by kind. The mapped type makes a missing entry a compile error. */
export const FRACTALS: { [K in FractalKind]: EscapeTimeFractal<K> } = {
  mandelbrot,
  julia,
};

export const FRACTAL_KINDS = Object.keys(FRACTALS) as FractalKind[];

export function isFractalKind(value: string): value is FractalKind {
  return value in FRACTALS;
}

/** Kinds announced in the UI but not implemented yet. */
export const UPCOMING = [
  { id: 'lsystem', title: 'L-system' },
  { id: 'ifs', title: 'IFS' },
] as const;

function bind<K extends FractalKind>(definition: EscapeTimeFractal<K>, params: ParamsOf<K>): BoundFractal {
  return {
    definition,
    iterations: (zoomLog) => definition.effectiveIterations(params, zoomLog),
    bindUniforms: (program) => definition.bindUniforms?.(program, params),
  };
}

/**
 * Pairs a fractal state with its definition. The switch lets the compiler
 * correlate `kind` with `params`, so no cast is needed, and adding a kind
 * without handling it here fails to compile.
 */
export function bindFractal(state: FractalState): BoundFractal {
  switch (state.kind) {
    case 'mandelbrot':
      return bind(FRACTALS.mandelbrot, state.params);
    case 'julia':
      return bind(FRACTALS.julia, state.params);
  }
}

/** Default state for a kind, optionally carrying over the iteration settings. */
export function defaultFractalState(kind: FractalKind, iteration?: IterationParams): FractalState {
  switch (kind) {
    case 'mandelbrot':
      return { kind, params: { ...FRACTALS.mandelbrot.defaultParams, ...iteration } };
    case 'julia':
      return { kind, params: { ...FRACTALS.julia.defaultParams, ...iteration } };
  }
}

/** Returns a copy of `state` with its shared iteration settings patched. */
export function withIteration(state: FractalState, patch: Partial<IterationParams>): FractalState {
  switch (state.kind) {
    case 'mandelbrot':
      return { kind: state.kind, params: { ...state.params, ...patch } };
    case 'julia':
      return { kind: state.kind, params: { ...state.params, ...patch } };
  }
}
