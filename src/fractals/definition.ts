import type { ComplexView, EscapeKind, EscapeTimeState, FractalKind } from './types';
import type { ShaderProgram } from '../gl/ShaderProgram';

export type EscapeParamsOf<K extends EscapeKind> = Extract<EscapeTimeState, { kind: K }>['params'];

/**
 * How a fractal becomes pixels:
 *   escape  per-pixel in a WebGL fragment shader (Mandelbrot, Julia)
 *   raster  geometry built in a Web Worker and drawn to a 2D canvas (L-systems)
 */
export type RenderFamily = 'escape' | 'raster';

/** What every fractal declares, independent of how it is rendered. */
export interface FractalInfo<K extends FractalKind = FractalKind> {
  kind: K;
  family: RenderFamily;
  title: string;
  /** Catalogue number shown on the placard, e.g. "Nº 01". */
  ordinal: string;
  /** Human-readable rule, shown in the UI. */
  formula: string;
  defaultView: ComplexView;
  /** Deepest useful zoom (log10). df64 allows ~13; finite geometry far less. */
  maxZoomLog: number;
}

/**
 * Contract every GPU escape-time fractal implements. The renderer owns the
 * shared uniforms (view, sampling, palette); a definition supplies its shader,
 * defaults and any uniforms of its own. Adding a fractal = one new module
 * plus one entry in the registry.
 */
export interface EscapeTimeFractal<K extends EscapeKind = EscapeKind> extends FractalInfo<K> {
  family: 'escape';
  fragmentShader: string;
  defaultParams: EscapeParamsOf<K>;
  /** Iteration budget actually sent to the GPU for a given zoom depth. */
  effectiveIterations(params: EscapeParamsOf<K>, zoomLog: number): number;
  /** Binds fractal-specific uniforms. Optional: Mandelbrot has none. */
  bindUniforms?(program: ShaderProgram, params: EscapeParamsOf<K>): void;
}

/** An escape-time definition paired with its parameters, kind already resolved. */
export interface BoundFractal {
  definition: FractalInfo;
  iterations(zoomLog: number): number;
  bindUniforms(program: ShaderProgram): void;
}
