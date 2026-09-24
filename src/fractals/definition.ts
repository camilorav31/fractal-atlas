import type { ComplexView, FractalKind, FractalState } from './types';
import type { ShaderProgram } from '../gl/ShaderProgram';

export type ParamsOf<K extends FractalKind> = Extract<FractalState, { kind: K }>['params'];

/**
 * Contract every GPU escape-time fractal implements. The renderer owns the
 * shared uniforms (view, sampling, palette); a definition supplies its shader,
 * defaults and any uniforms of its own. Adding a fractal = one new module
 * plus one entry in the registry.
 */
export interface EscapeTimeFractal<K extends FractalKind = FractalKind> {
  kind: K;
  title: string;
  /** Catalogue number shown on the placard, e.g. "Nº 01". */
  ordinal: string;
  /** Human-readable iteration rule, shown in the UI. */
  formula: string;
  fragmentShader: string;
  defaultParams: ParamsOf<K>;
  defaultView: ComplexView;
  /** Iteration budget actually sent to the GPU for a given zoom depth. */
  effectiveIterations(params: ParamsOf<K>, zoomLog: number): number;
  /** Binds fractal-specific uniforms. Optional: Mandelbrot has none. */
  bindUniforms?(program: ShaderProgram, params: ParamsOf<K>): void;
}

/** The parameter-independent part of a definition. */
export type FractalInfo = Pick<EscapeTimeFractal, 'kind' | 'title' | 'ordinal' | 'formula' | 'defaultView'>;

/** A definition paired with its parameters, with the kind already resolved. */
export interface BoundFractal {
  definition: FractalInfo;
  iterations(zoomLog: number): number;
  bindUniforms(program: ShaderProgram): void;
}
