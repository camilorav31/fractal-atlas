import { liftLightness, rasterizeGradient, hexToRgb } from '../../utils/color';
import { BASE_SPAN, pixelSize } from '../../utils/viewMath';
import type { AffineMap, ColorSettings, ComplexView, IFSParams } from '../types';
import { normalizedProbabilities } from './maps';

/**
 * The chaos game (Barnsley, 1988): start anywhere, repeatedly apply a map
 * chosen at random with probability pᵢ, and the orbit converges onto the
 * IFS attractor after a few steps. Instead of plotting dots, every hit is
 * accumulated into a density histogram and tone-mapped logarithmically —
 * the technique popularized by fractal flames (Draves, 1992) — so dense
 * cores glow and sparse filaments stay visible instead of saturating.
 */

/** Orbit steps discarded before plotting, while the point converges. */
const WARMUP = 24;
/** Samples used to measure the attractor's extent for framing. */
const BOUNDS_SAMPLES = 60_000;
const FIT = 0.86;
const FIT_ASPECT = 1.5;
/** Past this, a point has escaped (non-contractive custom maps): restart it. */
const ESCAPE = 1e6;
/** Zooming in spreads the same points over more pixels; sample more, up to this factor. */
const MAX_ZOOM_BOOST = 10;
const PALETTE_SIZE = 256;
const MIN_LIGHTNESS = 0.55;

/** Fixed seed: the same parameters always produce the same grain, so pans don't shimmer. */
const SEED = 0x9e3779b9;

function xorshift(seed: number): () => number {
  let s = seed >>> 0 || 1;
  return () => {
    s ^= s << 13;
    s ^= s >>> 17;
    s ^= s << 5;
    return (s >>> 0) / 4294967296;
  };
}

/** Cumulative probability table for picking maps. */
function cumulative(maps: readonly AffineMap[]): Float64Array {
  const ps = normalizedProbabilities(maps);
  const table = new Float64Array(ps.length);
  let acc = 0;
  ps.forEach((p, i) => (table[i] = acc += p));
  table[ps.length - 1] = 1;
  return table;
}

function pick(table: Float64Array, r: number): number {
  let i = 0;
  while (i < table.length - 1 && r > table[i]!) i++;
  return i;
}

export interface Framing {
  centerX: number;
  centerY: number;
  /** Attractor units → view units. */
  scale: number;
}

const framingCache = new Map<string, Framing>();

/**
 * Centres the attractor on the origin and scales it to fit the default view.
 * Uses 0.1 % / 99.9 % quantiles rather than min/max, so rare stray points
 * (or a slightly non-contractive custom map) can't wreck the framing.
 */
export function framingFor(maps: readonly AffineMap[]): Framing {
  const key = JSON.stringify(maps);
  const cached = framingCache.get(key);
  if (cached) return cached;

  const random = xorshift(SEED);
  const table = cumulative(maps);
  const xs = new Float64Array(BOUNDS_SAMPLES);
  const ys = new Float64Array(BOUNDS_SAMPLES);
  let x = 0, y = 0, n = 0;
  for (let i = 0; i < BOUNDS_SAMPLES + WARMUP; i++) {
    const m = maps[pick(table, random())]!;
    const nx = m.a * x + m.b * y + m.e;
    y = m.c * x + m.d * y + m.f;
    x = nx;
    if (!(Math.abs(x) < ESCAPE && Math.abs(y) < ESCAPE)) x = y = 0;
    if (i >= WARMUP) {
      xs[n] = x;
      ys[n] = y;
      n++;
    }
  }
  xs.sort();
  ys.sort();
  const q = (arr: Float64Array, t: number) => arr[Math.min(n - 1, Math.max(0, Math.floor(t * (n - 1))))]!;
  const minX = q(xs, 0.001), maxX = q(xs, 0.999), minY = q(ys, 0.001), maxY = q(ys, 0.999);
  const extent = Math.max(maxY - minY, (maxX - minX) / FIT_ASPECT, 1e-9);
  const framing = { centerX: (minX + maxX) / 2, centerY: (minY + maxY) / 2, scale: (BASE_SPAN * FIT) / extent };

  if (framingCache.size > 32) framingCache.clear();
  framingCache.set(key, framing);
  return framing;
}

// Histogram buffers are reused across frames (the worker renders one at a time).
let hits = new Float32Array(0);
let colorSum = new Float32Array(0);

export interface IFSFrame {
  pixels: Uint8ClampedArray;
  points: number;
}

/** Runs the chaos game for `view` and returns tone-mapped RGBA pixels. */
export function renderIFS(
  params: IFSParams,
  view: ComplexView,
  width: number,
  height: number,
  color: Pick<ColorSettings, 'density' | 'offset' | 'interior'>,
  stops: readonly string[],
): IFSFrame {
  const size = width * height;
  if (hits.length < size) {
    hits = new Float32Array(size);
    colorSum = new Float32Array(size);
  } else {
    hits.fill(0, 0, size);
    colorSum.fill(0, 0, size);
  }

  const { maps } = params;
  const framing = framingFor(maps);
  const table = cumulative(maps);
  const random = xorshift(SEED);
  // Each map owns a colour coordinate; the point's colour drifts toward it
  // every step, so a region inherits the hue of the maps that built it.
  const mapColor = maps.map((_, i) => (maps.length === 1 ? 0.5 : i / (maps.length - 1)));

  // attractor → pixel, folded into one affine transform per axis.
  const ps = pixelSize(view.zoomLog, height);
  const k = framing.scale / ps;
  const ox = width / 2 - (framing.centerX * framing.scale + view.centerX) / ps;
  const oy = height / 2 + (framing.centerY * framing.scale + view.centerY) / ps;

  const boost = Math.min(MAX_ZOOM_BOOST, 10 ** Math.max(0, view.zoomLog));
  const total = Math.round(params.points * boost);
  let x = 0, y = 0, c = 0.5;

  for (let i = 0; i < total + WARMUP; i++) {
    const index = pick(table, random());
    const m = maps[index]!;
    const nx = m.a * x + m.b * y + m.e;
    y = m.c * x + m.d * y + m.f;
    x = nx;
    c = (c + mapColor[index]!) * 0.5;
    if (!(Math.abs(x) < ESCAPE && Math.abs(y) < ESCAPE)) {
      x = y = 0;
      continue;
    }
    if (i < WARMUP) continue;
    const px = (x * k + ox) | 0;
    const py = (oy - y * k) | 0;
    if (px < 0 || py < 0 || px >= width || py >= height) continue;
    const o = py * width + px;
    hits[o]! += 1;
    colorSum[o]! += c;
  }

  return { pixels: toneMap(size, params, color, stops), points: total };
}

/**
 * Log-density tone mapping: brightness = (log(1 + n) / log(1 + max))^(1/γ),
 * scaled by exposure. Hue comes from the averaged colour coordinate, or
 * from the brightness itself when colouring by density.
 */
function toneMap(
  size: number,
  params: IFSParams,
  color: Pick<ColorSettings, 'density' | 'offset' | 'interior'>,
  stops: readonly string[],
): Uint8ClampedArray {
  let max = 0;
  for (let i = 0; i < size; i++) if (hits[i]! > max) max = hits[i]!;
  const logMax = Math.log1p(max) || 1;
  const invGamma = 1 / params.gamma;

  const palette = liftedPalette(stops);
  const [bgR, bgG, bgB] = hexToRgb(color.interior).map((v) => v * 255) as [number, number, number];
  const out = new Uint8ClampedArray(size * 4);

  for (let i = 0; i < size; i++) {
    const o = i * 4;
    const n = hits[i]!;
    if (n === 0) {
      out[o] = bgR;
      out[o + 1] = bgG;
      out[o + 2] = bgB;
      out[o + 3] = 255;
      continue;
    }
    const v = Math.min(1, (Math.log1p(n) / logMax) ** invGamma * params.exposure);
    const t = params.colorBy === 'density' ? v : colorSum[i]! / n;
    const phase = t * color.density + color.offset;
    const p = Math.floor((phase - Math.floor(phase)) * PALETTE_SIZE) * 3;
    out[o] = bgR + (palette[p]! - bgR) * v;
    out[o + 1] = bgG + (palette[p + 1]! - bgG) * v;
    out[o + 2] = bgB + (palette[p + 2]! - bgB) * v;
    out[o + 3] = 255;
  }
  return out;
}

/** Palette as packed RGB bytes, lifted so dark stops still read as colour. */
function liftedPalette(stops: readonly string[]): Uint8Array {
  const texels = rasterizeGradient(stops, PALETTE_SIZE);
  const out = new Uint8Array(PALETTE_SIZE * 3);
  for (let i = 0; i < PALETTE_SIZE; i++) {
    const rgb = liftLightness([texels[i * 4]! / 255, texels[i * 4 + 1]! / 255, texels[i * 4 + 2]! / 255], MIN_LIGHTNESS);
    out.set(rgb.map((v) => Math.round(v * 255)), i * 3);
  }
  return out;
}
