import { describe, expect, it } from 'vitest';
import { DEFAULT_COLOR } from '../../store/defaults';
import { PALETTES } from '../../utils/palettes';
import type { AffineMap } from '../types';
import { framingFor, renderIFS } from './chaos';
import {
  balancedProbabilities,
  contractionFactor,
  decodeMaps,
  encodeMaps,
  mutate,
  nonContractive,
  normalizedProbabilities,
} from './maps';
import { IFS_PRESETS, findIFSPreset, ifsParamsFromPreset } from './presets';

const map = (a: number, b: number, c: number, d: number, e = 0, f = 0, p = 1): AffineMap => ({ a, b, c, d, e, f, p });
const stops = PALETTES[0]!.stops;
const view = { centerX: 0, centerY: 0, zoomLog: 0 };

describe('affine maps', () => {
  it('computes the contraction factor (largest singular value)', () => {
    expect(contractionFactor(map(0.5, 0, 0, 0.5))).toBeCloseTo(0.5);
    const t = Math.PI / 5; // a rotation scaled by 0.7 contracts by exactly 0.7
    expect(contractionFactor(map(0.7 * Math.cos(t), -0.7 * Math.sin(t), 0.7 * Math.sin(t), 0.7 * Math.cos(t)))).toBeCloseTo(0.7);
    expect(contractionFactor(map(0.9, 0, 0, 0.1))).toBeCloseTo(0.9); // anisotropic: the larger axis wins
    expect(nonContractive([map(0.5, 0, 0, 0.5), map(1.2, 0, 0, 0.3)])).toEqual([1]);
  });

  it('every preset is a system of contractions', () => {
    for (const preset of IFS_PRESETS) expect(nonContractive(preset.maps), preset.id).toEqual([]);
  });

  it('balances probabilities by area and normalizes them', () => {
    const balanced = balancedProbabilities([map(0.5, 0, 0, 0.5), map(0.25, 0, 0, 0.25)]);
    expect(balanced[0]!.p / balanced[1]!.p).toBeCloseTo(4, 1);
    expect(normalizedProbabilities([map(1, 0, 0, 1, 0, 0, 2), map(1, 0, 0, 1, 0, 0, 6)])).toEqual([0.25, 0.75]);
    expect(normalizedProbabilities([map(1, 0, 0, 1, 0, 0, 0), map(1, 0, 0, 1, 0, 0, 0)])).toEqual([0.5, 0.5]);
  });

  it('round-trips the compact URL form and rejects malformed input', () => {
    const fern = findIFSPreset('fern')!.maps;
    expect(decodeMaps(encodeMaps(fern))).toEqual(fern);
    expect(decodeMaps('1,2,3')).toBeNull();
    expect(decodeMaps('a,b,c,d,e,f,p')).toBeNull();
    expect(decodeMaps('')).toBeNull();
    expect(decodeMaps('99,0,0,0.5,0,0,1')![0]!.a).toBe(10); // clamped
  });

  it('mutates without breaking contractivity', () => {
    let seed = 1;
    const random = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    const mutated = mutate(findIFSPreset('maple')!.maps, random, 0.2);
    expect(nonContractive(mutated)).toEqual([]);
    expect(mutated).not.toEqual(findIFSPreset('maple')!.maps);
  });
});

describe('chaos game', () => {
  it('frames the attractor around the origin', () => {
    const framing = framingFor(findIFSPreset('fern')!.maps);
    // The fern spans y ≈ 0…10: its centre is around y = 5.
    expect(framing.centerY).toBeGreaterThan(4);
    expect(framing.centerY).toBeLessThan(6);
    expect(framing.scale).toBeGreaterThan(0);
  });

  it('renders every preset with visible structure', () => {
    for (const preset of IFS_PRESETS) {
      const params = { ...ifsParamsFromPreset(preset), points: 40_000 };
      const { pixels } = renderIFS(params, view, 96, 64, DEFAULT_COLOR, stops);
      let lit = 0;
      for (let i = 0; i < pixels.length; i += 4) if (pixels[i]! + pixels[i + 1]! + pixels[i + 2]! > 60) lit++;
      expect(lit, preset.id).toBeGreaterThan(50);
    }
  });

  it('is deterministic, so pans and rerenders never shimmer', () => {
    const params = { ...ifsParamsFromPreset(findIFSPreset('sierpinski')!), points: 20_000 };
    const a = renderIFS(params, view, 48, 32, DEFAULT_COLOR, stops).pixels.slice();
    const b = renderIFS(params, view, 48, 32, DEFAULT_COLOR, stops).pixels.slice();
    expect(a).toEqual(b);
  });

  it('survives a diverging custom map', () => {
    const params = { ...ifsParamsFromPreset(findIFSPreset('fern')!), maps: [map(2, 0, 0, 2, 1, 1, 0.5), map(0.5, 0, 0, 0.5, 0, 0, 0.5)], points: 20_000 };
    const { pixels } = renderIFS(params, view, 32, 32, DEFAULT_COLOR, stops);
    expect(pixels.every((v) => Number.isFinite(v))).toBe(true);
  });

  it('samples more points when zoomed in, up to a cap', () => {
    const params = { ...ifsParamsFromPreset(findIFSPreset('fern')!), points: 10_000 };
    expect(renderIFS(params, { ...view, zoomLog: 0.5 }, 16, 16, DEFAULT_COLOR, stops).points).toBeGreaterThan(30_000);
    expect(renderIFS(params, { ...view, zoomLog: 3 }, 16, 16, DEFAULT_COLOR, stops).points).toBe(100_000);
  });
});
