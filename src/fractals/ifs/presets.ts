import type { AffineMap, IFSParams, IFSPresetId } from '../types';

export interface IFSPreset {
  id: IFSPresetId;
  name: string;
  maps: AffineMap[];
  colorBy: IFSParams['colorBy'];
}

const m = (a: number, b: number, c: number, d: number, e: number, f: number, p: number): AffineMap => ({ a, b, c, d, e, f, p });

/** Classic attractors (Barnsley, *Fractals Everywhere*, 1988, and the standard IFS literature). */
export const IFS_PRESETS: readonly IFSPreset[] = [
  {
    id: 'fern',
    name: 'Barnsley fern',
    colorBy: 'map',
    maps: [
      m(0, 0, 0, 0.16, 0, 0, 0.01), // stem
      m(0.85, 0.04, -0.04, 0.85, 0, 1.6, 0.85), // successively smaller leaflets
      m(0.2, -0.26, 0.23, 0.22, 0, 1.6, 0.07), // largest left leaflet
      m(-0.15, 0.28, 0.26, 0.24, 0, 0.44, 0.07), // largest right leaflet
    ],
  },
  {
    id: 'maple',
    name: 'Maple leaf',
    colorBy: 'map',
    maps: [
      m(0.14, 0.01, 0, 0.51, -0.08, -1.31, 0.1),
      m(0.43, 0.52, -0.45, 0.5, 1.49, -0.75, 0.35),
      m(0.45, -0.49, 0.47, 0.47, -1.62, -0.74, 0.35),
      m(0.49, 0, 0, 0.51, 0.02, 1.62, 0.2),
    ],
  },
  {
    id: 'tree',
    name: 'Fractal tree',
    colorBy: 'map',
    maps: [
      m(0, 0, 0, 0.5, 0, 0, 0.05),
      m(0.42, -0.42, 0.42, 0.42, 0, 0.2, 0.4),
      m(0.42, 0.42, -0.42, 0.42, 0, 0.2, 0.4),
      m(0.1, 0, 0, 0.1, 0, 0.2, 0.15),
    ],
  },
  {
    id: 'sierpinski',
    name: 'Sierpiński triangle',
    colorBy: 'map',
    maps: [
      m(0.5, 0, 0, 0.5, 0, 0, 1 / 3),
      m(0.5, 0, 0, 0.5, 0.5, 0, 1 / 3),
      m(0.5, 0, 0, 0.5, 0.25, 0.433, 1 / 3),
    ],
  },
  {
    id: 'spiral',
    name: 'Spiral',
    colorBy: 'density',
    maps: [
      m(0.787879, -0.424242, 0.242424, 0.859848, 1.758647, 1.408065, 0.9),
      m(-0.121212, 0.257576, 0.151515, 0.05303, -6.721654, 1.377236, 0.05),
      m(0.181818, -0.136364, 0.090909, 0.181818, 6.086107, 1.568035, 0.05),
    ],
  },
  {
    id: 'levy',
    name: 'Lévy C curve',
    colorBy: 'map',
    maps: [m(0.5, -0.5, 0.5, 0.5, 0, 0, 0.5), m(0.5, 0.5, -0.5, 0.5, 0.5, 0.5, 0.5)],
  },
  {
    id: 'dragon',
    name: 'Heighway dragon',
    colorBy: 'map',
    maps: [m(0.5, -0.5, 0.5, 0.5, 0, 0, 0.5), m(-0.5, -0.5, 0.5, -0.5, 1, 0, 0.5)],
  },
];

export const findIFSPreset = (id: string) => IFS_PRESETS.find((p) => p.id === id);

export const DEFAULT_IFS_RENDER: Pick<IFSParams, 'points' | 'exposure' | 'gamma'> = {
  points: 3_000_000,
  exposure: 1.4,
  gamma: 2.2,
};

export function ifsParamsFromPreset(preset: IFSPreset, render = DEFAULT_IFS_RENDER): IFSParams {
  return {
    preset: preset.id,
    maps: preset.maps.map((map) => ({ ...map })),
    colorBy: preset.colorBy,
    points: render.points,
    exposure: render.exposure,
    gamma: render.gamma,
  };
}
