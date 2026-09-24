import fragmentShader from '../../shaders/julia.frag';
import { splitDouble } from '../../utils/viewMath';
import type { EscapeTimeFractal } from '../definition';
import { DEFAULT_ITERATIONS, scaledIterations } from '../iterations';

/** |c| > 2 always yields Cantor dust that escapes almost immediately. */
export const JULIA_C_LIMIT = 2;

export const julia: EscapeTimeFractal<'julia'> = {
  kind: 'julia',
  title: 'Julia set',
  ordinal: 'Nº 02',
  formula: 'zₙ₊₁ = zₙ² + c',
  fragmentShader,
  // A classic: c just outside the main cardioid gives interlocking spirals.
  defaultParams: { ...DEFAULT_ITERATIONS, cRe: -0.8, cIm: 0.156 },
  defaultView: { centerX: 0, centerY: 0, zoomLog: 0 },
  effectiveIterations: scaledIterations,
  bindUniforms(program, params) {
    const [reHi, reLo] = splitDouble(params.cRe);
    const [imHi, imLo] = splitDouble(params.cIm);
    program.vec4('u_c', reHi, imHi, reLo, imLo);
  },
};
