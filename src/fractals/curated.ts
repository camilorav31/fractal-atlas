import { DEFAULT_COLOR } from '../store/defaults';
import { IFS_PRESETS, ifsParamsFromPreset } from './ifs/presets';
import { LSYSTEM_PRESETS, paramsFromPreset } from './lsystem/presets';
import type { FractalKind, SceneSnapshot } from './types';

export interface CuratedView {
  id: string;
  name: string;
  snapshot: SceneSnapshot;
}

const iteration = { maxIterations: 400, autoIterations: true };

const view = (
  centerX: number,
  centerY: number,
  zoomLog: number,
  color: Partial<SceneSnapshot['color']> = {},
): SceneSnapshot => ({
  fractal: { kind: 'mandelbrot', params: iteration },
  view: { centerX, centerY, zoomLog },
  color: { ...DEFAULT_COLOR, ...color },
});

const julia = (
  cRe: number,
  cIm: number,
  color: Partial<SceneSnapshot['color']> = {},
  frame: { centerX?: number; centerY?: number; zoomLog?: number } = {},
): SceneSnapshot => ({
  fractal: { kind: 'julia', params: { ...iteration, cRe, cIm } },
  view: { centerX: 0, centerY: 0, zoomLog: 0, ...frame },
  color: { ...DEFAULT_COLOR, ...color },
});

/** Well-known Mandelbrot locations, from shallow fp32 views to df64 depths. */
const MANDELBROT_VIEWS: readonly CuratedView[] = [
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

/** Classic Julia constants, each named for the shape it produces. */
const JULIA_VIEWS: readonly CuratedView[] = [
  { id: 'julia-spirals', name: 'Twin Spirals', snapshot: julia(-0.8, 0.156, { palette: 'nacre', density: 1 }) },
  { id: 'julia-rabbit', name: 'Douady Rabbit', snapshot: julia(-0.123, 0.745, { palette: 'gilt', density: 1.4 }) },
  { id: 'julia-dendrite', name: 'Dendrite', snapshot: julia(0, 1, { palette: 'aurora', density: 1.6 }) },
  { id: 'julia-siegel', name: 'Siegel Disk', snapshot: julia(-0.390541, -0.586788, { palette: 'obsidian', density: 1 }) },
  { id: 'julia-dragon', name: 'Dragon', snapshot: julia(-0.835, -0.2321, { palette: 'ember', density: 1 }) },
  { id: 'julia-feathers', name: 'Feathers', snapshot: julia(0.285, 0.01, { palette: 'ink', density: 1.2 }) },
  {
    // A point on the rabbit's boundary (found by bisection along the real axis), deep in df64 range.
    id: 'julia-rabbit-coast',
    name: 'Rabbit Coast',
    snapshot: julia(-0.123, 0.745, { palette: 'gilt', density: 0.8 }, { centerX: 0.3547932910029418, zoomLog: 6 }),
  },
];

/** Palette for each classic L-system: warm growth for plants, cool light for curves. */
const LSYSTEM_LOOKS: Record<string, Partial<SceneSnapshot['color']>> = {
  plant: { palette: 'aurora', density: 0.9 },
  tree: { palette: 'gilt', density: 0.8 },
  bush: { palette: 'ember', density: 0.9 },
  koch: { palette: 'nacre', density: 1 },
  snowflake: { palette: 'obsidian', density: 1 },
  dragon: { palette: 'ember', density: 1.5 },
  sierpinski: { palette: 'gilt', density: 1.2 },
  hilbert: { palette: 'aurora', density: 1.3 },
};

const LSYSTEM_VIEWS: readonly CuratedView[] = LSYSTEM_PRESETS.map((preset) => ({
  id: `lsystem-${preset.id}`,
  name: preset.name,
  snapshot: {
    fractal: { kind: 'lsystem', params: paramsFromPreset(preset) },
    view: { centerX: 0, centerY: 0, zoomLog: 0 },
    color: { ...DEFAULT_COLOR, ...LSYSTEM_LOOKS[preset.id] },
  },
}));

/** Palettes chosen per attractor: botanical greens and golds, cool light for the curves. */
const IFS_LOOKS: Record<string, Partial<SceneSnapshot['color']>> = {
  fern: { palette: 'aurora', density: 0.9 },
  maple: { palette: 'ember', density: 1 },
  tree: { palette: 'gilt', density: 1 },
  sierpinski: { palette: 'nacre', density: 1 },
  spiral: { palette: 'obsidian', density: 1.4 },
  levy: { palette: 'aurora', density: 1.2 },
  dragon: { palette: 'ember', density: 1.1 },
};

const IFS_VIEWS: readonly CuratedView[] = IFS_PRESETS.map((preset) => ({
  id: `ifs-${preset.id}`,
  name: preset.name,
  snapshot: {
    fractal: { kind: 'ifs', params: ifsParamsFromPreset(preset) },
    view: { centerX: 0, centerY: 0, zoomLog: 0 },
    color: { ...DEFAULT_COLOR, ...IFS_LOOKS[preset.id] },
  },
}));

export const CURATED: { [K in FractalKind]: readonly CuratedView[] } = {
  mandelbrot: MANDELBROT_VIEWS,
  julia: JULIA_VIEWS,
  lsystem: LSYSTEM_VIEWS,
  ifs: IFS_VIEWS,
};
