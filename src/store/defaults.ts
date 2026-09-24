import { FRACTALS, defaultFractalState } from '../fractals/registry';
import type { ColorSettings, FractalKind, SceneSnapshot } from '../fractals/types';

export const DEFAULT_COLOR: ColorSettings = {
  palette: 'gilt',
  customStops: ['#050510', '#1c2a6b', '#e4e9ff', '#c9a45a'],
  density: 1.2,
  offset: 0,
  edgeShading: 0.6,
  interior: '#050507',
};

export function defaultSnapshot(kind: FractalKind = 'mandelbrot'): SceneSnapshot {
  return {
    fractal: defaultFractalState(kind),
    view: { ...FRACTALS[kind].defaultView },
    color: { ...DEFAULT_COLOR, customStops: [...DEFAULT_COLOR.customStops] },
  };
}
