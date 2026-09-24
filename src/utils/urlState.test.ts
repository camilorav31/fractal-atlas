import { describe, expect, it } from 'vitest';
import { defaultSnapshot } from '../store/defaults';
import { decodeScene, encodeScene } from './urlState';
import { pixelSize } from './viewMath';

describe('urlState', () => {
  it('returns null when the query carries no scene', () => {
    expect(decodeScene('')).toBeNull();
    expect(decodeScene('?utm_source=x')).toBeNull();
  });

  it('round-trips a deep view to within a fraction of a pixel', () => {
    const scene = defaultSnapshot();
    scene.view = { centerX: -0.7436438870371587, centerY: 0.131825904205312, zoomLog: 11.2 };
    scene.fractal.params = { maxIterations: 1200, autoIterations: false };
    scene.color = { ...scene.color, palette: 'ember', density: 0.6, offset: 0.25 };

    const decoded = decodeScene(encodeScene(scene))!;
    const tolerance = pixelSize(scene.view.zoomLog, 2160) / 10;
    expect(Math.abs(decoded.view.centerX - scene.view.centerX)).toBeLessThan(tolerance);
    expect(Math.abs(decoded.view.centerY - scene.view.centerY)).toBeLessThan(tolerance);
    expect(decoded.view.zoomLog).toBeCloseTo(11.2, 3);
    expect(decoded.fractal.params).toEqual({ maxIterations: 1200, autoIterations: false });
    expect(decoded.color.palette).toBe('ember');
    expect(decoded.color.offset).toBeCloseTo(0.25, 3);
  });

  it('keeps shallow links short', () => {
    const query = encodeScene(defaultSnapshot());
    expect(new URLSearchParams(query).get('x')).toBe('-0.6');
  });

  it('round-trips a custom gradient', () => {
    const scene = defaultSnapshot();
    scene.color = { ...scene.color, palette: 'custom', customStops: ['#101010', '#abcdef', '#ff8800'] };
    expect(decodeScene(encodeScene(scene))!.color.customStops).toEqual(['#101010', '#abcdef', '#ff8800']);
  });

  it('falls back and clamps instead of trusting hand-edited links', () => {
    const decoded = decodeScene('?f=mandelbrot&x=abc&y=1e9&z=99&it=-5&p=nope&in=zzz&cs=12')!;
    const defaults = defaultSnapshot();
    expect(decoded.view.centerX).toBe(defaults.view.centerX);
    expect(decoded.view.centerY).toBe(4);
    expect(decoded.view.zoomLog).toBe(13);
    expect(decoded.fractal.params.maxIterations).toBe(32);
    expect(decoded.color.palette).toBe(defaults.color.palette);
    expect(decoded.color.interior).toBe(defaults.color.interior);
  });

  it('rejects a custom palette with fewer than two valid stops', () => {
    expect(decodeScene('?f=mandelbrot&p=custom&cs=ff0000')!.color.palette).toBe('gilt');
  });

  it('round-trips a Julia scene, including c', () => {
    const scene = defaultSnapshot('julia');
    if (scene.fractal.kind !== 'julia') throw new Error('expected julia');
    scene.fractal.params = { ...scene.fractal.params, cRe: -0.7436438870371587, cIm: 0.131825904205312 };
    const decoded = decodeScene(encodeScene(scene))!;
    expect(decoded.fractal.kind).toBe('julia');
    if (decoded.fractal.kind !== 'julia') return;
    expect(decoded.fractal.params.cRe).toBeCloseTo(-0.7436438870371587, 13);
    expect(decoded.fractal.params.cIm).toBeCloseTo(0.131825904205312, 13);
  });

  it('clamps an out-of-range Julia constant and ignores unknown kinds', () => {
    const decoded = decodeScene('?f=julia&cr=9&ci=-9')!;
    expect(decoded.fractal).toMatchObject({ kind: 'julia', params: { cRe: 2, cIm: -2 } });
    expect(decodeScene('?f=lsystem')).toBeNull();
  });
});
