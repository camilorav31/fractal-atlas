import type { ComplexView, FractalKind, FractalState } from './types';
import type { ShaderProgram } from '../gl/ShaderProgram';

type ParamsOf<K extends FractalKind> = Extract<FractalState, { kind: K }>['params'];

/**
 * Contract every GPU escape-time fractal implements. The renderer owns the
 * shared uniforms (view, sampling, palette); a definition supplies its shader,
 * defaults and any uniforms of its own. Adding a fractal = one new module
 * plus one entry in the registry.
 */
export interface EscapeTimeFractal<K extends FractalKind = FractalKind> {
  kind: K;
  title: string;
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
