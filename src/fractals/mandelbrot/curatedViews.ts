import type { SceneSnapshot } from '../types';
import { DEFAULT_COLOR } from '../../store/defaults';

export interface CuratedView {
  id: string;
  name: string;
  snapshot: SceneSnapshot;
}

const view = (
  centerX: number,
  centerY: number,
  zoomLog: number,
  color: Partial<SceneSnapshot['color']> = {},
): SceneSnapshot => ({
  fractal: { kind: 'mandelbrot', params: { maxIterations: 400, autoIterations: true } },
  view: { centerX, centerY, zoomLog },
  color: { ...DEFAULT_COLOR, ...color },
});

/** Well-known locations, from shallow fp32 views to df64 depths. */
export const CURATED_VIEWS: readonly CuratedView[] = [
  { id: 'seahorse', name: 'Seahorse Valley', snapshot: view(-0.7463, 0.1102, 2.7, { palette: 'gilt', density: 1.4 }) },
  { id: 'elephants', name: 'Elephant Valley', snapshot: view(0.2925755, -0.0149977, 2.6, { palette: 'aurora' }) },
  { id: 'spiral', name: 'Double Spiral', snapshot: view(-0.761574, -0.0847596, 3.2, { palette: 'nacre', density: 1 }) },
  {
    id: 'tendrils',
    name: 'Tendrils',
    snapshot: view(-0.7746806106269039, -0.1374168856037867, 4.6, { palette: 'nacre', density: 0.9 }),
  },
  { id: 'needle', name: 'Needle', snapshot: view(-1.7685, 0.00173, 3.5, { palette: 'obsidian', density: 1 }) },
  {
    id: 'abyss',
    name: 'Abyss',
    snapshot: view(-0.7436438870371587, 0.131825904205312, 11, { palette: 'ember', density: 0.6 }),
  },
];
