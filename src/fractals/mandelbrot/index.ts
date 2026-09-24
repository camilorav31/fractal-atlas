import fragmentShader from '../../shaders/mandelbrot.frag';
import { MAX_ZOOM_LOG } from '../../utils/viewMath';
import type { EscapeTimeFractal } from '../definition';
import { DEFAULT_ITERATIONS, scaledIterations } from '../iterations';

export const mandelbrot: EscapeTimeFractal<'mandelbrot'> = {
  kind: 'mandelbrot',
  family: 'escape',
  title: 'Mandelbrot set',
  ordinal: 'Nº 01',
  formula: 'zₙ₊₁ = zₙ² + c',
  fragmentShader,
  defaultParams: { ...DEFAULT_ITERATIONS },
  maxZoomLog: MAX_ZOOM_LOG,
  defaultView: { centerX: -0.6, centerY: 0, zoomLog: 0 },
  effectiveIterations: scaledIterations,
};
