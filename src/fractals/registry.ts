import type { BoundFractal, EscapeParamsOf, EscapeTimeFractal, FractalInfo } from './definition';
import { ifs, ifsDefaults } from './ifs';
import { julia } from './julia';
import { lsystem, lsystemDefaults } from './lsystem';
import { mandelbrot } from './mandelbrot';
import type {
  EscapeKind,
  EscapeScene,
  EscapeTimeState,
  FractalKind,
  FractalState,
  IterationParams,
  RasterScene,
  SceneSnapshot,
} from './types';

/** GPU escape-time fractals, keyed by kind. The mapped type makes a missing entry a compile error. */
export const FRACTALS: { [K in EscapeKind]: EscapeTimeFractal<K> } = {
  mandelbrot,
  julia,
};

/** Metadata for every fractal, whatever renders it. */
export const FRACTAL_INFO: { [K in FractalKind]: FractalInfo<K> } = {
  mandelbrot,
  julia,
  lsystem,
  ifs,
};

export const FRACTAL_KINDS = Object.keys(FRACTAL_INFO) as FractalKind[];

export function isFractalKind(value: string): value is FractalKind {
  return value in FRACTAL_INFO;
}

export function isEscapeState(state: FractalState): state is EscapeTimeState {
  return FRACTAL_INFO[state.kind].family === 'escape';
}

export function isEscapeScene(scene: SceneSnapshot): scene is EscapeScene {
  return isEscapeState(scene.fractal);
}

export function isRasterScene(scene: SceneSnapshot): scene is RasterScene {
  return !isEscapeState(scene.fractal);
}

function bind<K extends EscapeKind>(definition: EscapeTimeFractal<K>, params: EscapeParamsOf<K>): BoundFractal {
  return {
    definition,
    iterations: (zoomLog) => definition.effectiveIterations(params, zoomLog),
    bindUniforms: (program) => definition.bindUniforms?.(program, params),
  };
}

/**
 * Pairs an escape-time state with its definition. The switch lets the
 * compiler correlate `kind` with `params`, so no cast is needed, and adding
 * a kind without handling it here fails to compile.
 */
export function bindFractal(state: EscapeTimeState): BoundFractal {
  switch (state.kind) {
    case 'mandelbrot':
      return bind(FRACTALS.mandelbrot, state.params);
    case 'julia':
      return bind(FRACTALS.julia, state.params);
  }
}

/** Default state for a kind, optionally carrying over escape-time iteration settings. */
export function defaultFractalState(kind: FractalKind, iteration?: IterationParams): FractalState {
  switch (kind) {
    case 'mandelbrot':
      return { kind, params: { ...FRACTALS.mandelbrot.defaultParams, ...iteration } };
    case 'julia':
      return { kind, params: { ...FRACTALS.julia.defaultParams, ...iteration } };
    case 'lsystem':
      return { kind, params: { ...lsystemDefaults } };
    case 'ifs':
      return { kind, params: { ...ifsDefaults, maps: ifsDefaults.maps.map((m) => ({ ...m })) } };
  }
}

/** Returns a copy of `state` with its iteration settings patched (no-op for raster kinds). */
export function withIteration(state: FractalState, patch: Partial<IterationParams>): FractalState {
  switch (state.kind) {
    case 'mandelbrot':
      return { kind: state.kind, params: { ...state.params, ...patch } };
    case 'julia':
      return { kind: state.kind, params: { ...state.params, ...patch } };
    case 'lsystem':
    case 'ifs':
      return state;
  }
}
