import type { EscapeTimeFractal } from './definition';
import type { FractalKind } from './types';
import { mandelbrot } from './mandelbrot';

/** Registered fractals, keyed by kind. The mapped type makes a missing entry a compile error. */
export const FRACTALS: { [K in FractalKind]: EscapeTimeFractal<K> } = {
  mandelbrot,
};

/** Kinds announced in the UI but not implemented yet. */
export const UPCOMING = [
  { id: 'julia', title: 'Julia' },
  { id: 'lsystem', title: 'L-system' },
  { id: 'ifs', title: 'IFS' },
] as const;
