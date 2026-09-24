import { describe, expect, it } from 'vitest';
import { hexToRgb, hsvToRgb, rasterizeGradient, rgbToHex, rgbToHsv } from './color';

describe('hex conversion', () => {
  it('round-trips', () => {
    for (const hex of ['#000000', '#ffffff', '#d9bf85', '#123abc']) {
      expect(rgbToHex(hexToRgb(hex))).toBe(hex);
    }
  });

  it('rejects malformed input', () => {
    expect(() => hexToRgb('#fff')).toThrow();
  });
});

describe('HSV', () => {
  it('round-trips through RGB', () => {
    const hsv = { h: 212, s: 0.63, v: 0.8 };
    const back = rgbToHsv(hsvToRgb(hsv));
    expect(back.h).toBeCloseTo(hsv.h, 6);
    expect(back.s).toBeCloseTo(hsv.s, 6);
    expect(back.v).toBeCloseTo(hsv.v, 6);
  });
});

describe('rasterizeGradient', () => {
  it('starts exactly on the first stop and is fully opaque', () => {
    const texels = rasterizeGradient(['#ff0000', '#0000ff'], 256);
    expect(texels.length).toBe(256 * 4);
    expect([...texels.slice(0, 4)]).toEqual([255, 0, 0, 255]);
    for (let i = 3; i < texels.length; i += 4) expect(texels[i]).toBe(255);
  });

  it('is cyclic: the last texel blends back toward the first stop', () => {
    const texels = rasterizeGradient(['#ff0000', '#0000ff'], 256);
    const last = [...texels.slice(-4, -1)];
    expect(last[0]!).toBeGreaterThan(200); // mostly red again
    expect(last[2]!).toBeLessThan(40);
  });

  it('interpolates perceptually: the red→green midpoint is not the muddy sRGB average', () => {
    const texels = rasterizeGradient(['#ff0000', '#00ff00'], 256);
    const mid = [...texels.slice(64 * 4, 64 * 4 + 3)];
    // Naive sRGB mixing gives (128, 128, 0); OKLab keeps it much brighter.
    expect(mid[0]! + mid[1]!).toBeGreaterThan(300);
  });
});
