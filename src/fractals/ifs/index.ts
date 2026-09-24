import type { FractalInfo } from '../definition';
import type { IFSParams } from '../types';
import { findIFSPreset, ifsParamsFromPreset } from './presets';

export const ifs: FractalInfo<'ifs'> = {
  kind: 'ifs',
  family: 'raster',
  title: 'Iterated function system',
  ordinal: 'Nº 04',
  formula: 'A = ⋃ wᵢ(A)',
  // A point cloud: past ~10³× the samples thin out into grain.
  maxZoomLog: 3,
  defaultView: { centerX: 0, centerY: 0, zoomLog: 0 },
};

export const ifsDefaults: IFSParams = ifsParamsFromPreset(findIFSPreset('fern')!);
