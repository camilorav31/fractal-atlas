/**
 * Colour utilities. Gradients are interpolated in OKLab (Björn Ottosson, 2020),
 * a perceptually uniform space: midpoints between two colours look like real
 * midpoints, without the muddy greys that plain sRGB interpolation produces.
 */

export type Rgb = [r: number, g: number, b: number];

const HEX_PATTERN = /^#?([0-9a-f]{6})$/i;

export function isHexColor(value: string): boolean {
  return HEX_PATTERN.test(value);
}

/** Parses #rrggbb into sRGB components in [0, 1]. */
export function hexToRgb(hex: string): Rgb {
  const match = HEX_PATTERN.exec(hex);
  if (!match?.[1]) throw new Error(`Invalid hex colour: ${hex}`);
  const n = parseInt(match[1], 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}

export function rgbToHex([r, g, b]: Rgb): string {
  const byte = (v: number) => Math.round(Math.min(1, Math.max(0, v)) * 255).toString(16).padStart(2, '0');
  return `#${byte(r)}${byte(g)}${byte(b)}`;
}

export const srgbToLinear = (c: number) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
export const linearToSrgb = (c: number) =>
  c <= 0.0031308 ? c * 12.92 : 1.055 * c ** (1 / 2.4) - 0.055;

function linearRgbToOklab([r, g, b]: Rgb): Rgb {
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  return [
    0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  ];
}

function oklabToLinearRgb([L, a, b]: Rgb): Rgb {
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
  return [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ];
}

export const hexToOklab = (hex: string): Rgb => linearRgbToOklab(hexToRgb(hex).map(srgbToLinear) as Rgb);

/**
 * Rasterizes evenly spaced, *cyclic* colour stops into `size` RGBA8 texels
 * (sRGB-encoded). The last stop blends back into the first, so the texture
 * tiles seamlessly under REPEAT wrapping.
 */
export function rasterizeGradient(stops: readonly string[], size = 256): Uint8Array {
  if (stops.length === 0) throw new Error('A gradient needs at least one stop');
  const lab = stops.map(hexToOklab);
  const out = new Uint8Array(size * 4);
  for (let i = 0; i < size; i++) {
    const t = (i / size) * lab.length;
    const index = Math.floor(t);
    const a = lab[index % lab.length]!;
    const b = lab[(index + 1) % lab.length]!;
    const f = t - index;
    const mixed: Rgb = [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f, a[2] + (b[2] - a[2]) * f];
    const rgb = oklabToLinearRgb(mixed).map((c) => linearToSrgb(Math.min(1, Math.max(0, c))));
    out.set([...rgb.map((c) => Math.round(c * 255)), 255], i * 4);
  }
  return out;
}

/** Hex → linear RGB, the form colour uniforms are consumed in. */
export const hexToLinear = (hex: string): Rgb => hexToRgb(hex).map(srgbToLinear) as Rgb;

/** CSS linear-gradient for UI swatches that mirrors the cyclic texture. */
export function cssGradient(stops: readonly string[], angle = 90): string {
  const all = [...stops, stops[0]];
  return `linear-gradient(${angle}deg, ${all
    .map((c, i) => `${c} ${((i / stops.length) * 100).toFixed(2)}%`)
    .join(', ')})`;
}

// --- HSV, used by the custom colour picker -------------------------------

export interface Hsv {
  h: number; // [0, 360)
  s: number; // [0, 1]
  v: number; // [0, 1]
}

export function hsvToRgb({ h, s, v }: Hsv): Rgb {
  const f = (n: number) => {
    const k = (n + h / 60) % 6;
    return v - v * s * Math.max(0, Math.min(k, 4 - k, 1));
  };
  return [f(5), f(3), f(1)];
}

export function rgbToHsv([r, g, b]: Rgb): Hsv {
  const max = Math.max(r, g, b);
  const d = max - Math.min(r, g, b);
  let h = 0;
  if (d > 0) {
    if (max === r) h = ((g - b) / d) % 6;
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
  }
  return { h: (h * 60 + 360) % 360, s: max === 0 ? 0 : d / max, v: max };
}
