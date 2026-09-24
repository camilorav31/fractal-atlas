import type { FractalInfo } from '../definition';
import type { LSystemParams } from '../types';
import { findPreset, paramsFromPreset } from './presets';

/** Finite geometry: past ~10⁴× a segment is wider than the screen. */
export const LSYSTEM_MAX_ZOOM_LOG = 4;

export const lsystem: FractalInfo<'lsystem'> = {
  kind: 'lsystem',
  family: 'raster',
  title: 'Lindenmayer system',
  ordinal: 'Nº 03',
  formula: 'ω → P(ω)',
  maxZoomLog: LSYSTEM_MAX_ZOOM_LOG,
  defaultView: { centerX: 0, centerY: 0, zoomLog: 0 },
};

export const lsystemDefaults: LSystemParams = paramsFromPreset(findPreset('plant')!);
