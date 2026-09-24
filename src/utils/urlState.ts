import { JULIA_C_LIMIT } from '../fractals/julia';
import { MAX_ITERATIONS, MIN_ITERATIONS } from '../fractals/iterations';
import { isFractalKind } from '../fractals/registry';
import type { FractalState, SceneSnapshot } from '../fractals/types';
import { defaultSnapshot } from '../store/defaults';
import { isHexColor } from './color';
import { isPaletteId } from './palettes';
import { MAX_ZOOM_LOG, MIN_ZOOM_LOG, clamp } from './viewMath';

/**
 * Scene ⇄ query string. Short keys keep shared links readable:
 *
 *   ?f=mandelbrot&x=-0.7436438870371&y=0.1318259042&z=9.2&it=400&p=gilt
 *   ?f=julia&cr=-0.8&ci=0.156&x=0&y=0&z=0&p=nacre
 *
 * Decoding is defensive: every field is validated and clamped, and anything
 * missing or malformed falls back to its default, so a hand-edited or
 * truncated link still opens a sensible view.
 */

/** Coordinates only need enough digits to resolve a pixel at the current zoom. */
function coordinateDigits(zoomLog: number): number {
  return clamp(Math.ceil(zoomLog) + 6, 6, 17);
}

const trimNumber = (value: number, digits: number) => String(Number(value.toPrecision(digits)));
const stripHash = (hex: string) => hex.replace('#', '').toLowerCase();

export function encodeScene({ fractal, view, color }: SceneSnapshot): string {
  const digits = coordinateDigits(view.zoomLog);
  const params = new URLSearchParams({
    f: fractal.kind,
    x: trimNumber(view.centerX, digits),
    y: trimNumber(view.centerY, digits),
    z: view.zoomLog.toFixed(3),
    it: String(fractal.params.maxIterations),
    ai: fractal.params.autoIterations ? '1' : '0',
    p: color.palette,
    d: color.density.toFixed(3),
    o: color.offset.toFixed(3),
    e: color.edgeShading.toFixed(2),
    in: stripHash(color.interior),
  });
  if (fractal.kind === 'julia') {
    params.set('cr', trimNumber(fractal.params.cRe, 15));
    params.set('ci', trimNumber(fractal.params.cIm, 15));
  }
  if (color.palette === 'custom') params.set('cs', color.customStops.map(stripHash).join('-'));
  return params.toString();
}

function readNumber(params: URLSearchParams, key: string, fallback: number, min = -Infinity, max = Infinity): number {
  const raw = params.get(key);
  if (raw === null || raw.trim() === '') return fallback;
  const value = Number(raw);
  return Number.isFinite(value) ? clamp(value, min, max) : fallback;
}

function readHex(params: URLSearchParams, key: string, fallback: string): string {
  const raw = params.get(key);
  return raw && isHexColor(raw) ? `#${raw.replace('#', '').toLowerCase()}` : fallback;
}

/** Returns null when the query string carries no scene at all. */
export function decodeScene(search: string): SceneSnapshot | null {
  const params = new URLSearchParams(search);
  const kind = params.get('f') ?? '';
  if (!isFractalKind(kind)) return null;

  const base = defaultSnapshot(kind);
  const palette = params.get('p') ?? '';
  const customStops = (params.get('cs') ?? '')
    .split('-')
    .filter(isHexColor)
    .map((hex) => `#${hex.toLowerCase()}`)
    .slice(0, 6);
  const hasCustom = palette === 'custom' && customStops.length >= 2;

  const iteration = {
    maxIterations: Math.round(readNumber(params, 'it', base.fractal.params.maxIterations, MIN_ITERATIONS, MAX_ITERATIONS)),
    autoIterations: params.get('ai') !== '0',
  };
  let fractal: FractalState;
  if (base.fractal.kind === 'julia') {
    const { cRe, cIm } = base.fractal.params;
    fractal = {
      kind: 'julia',
      params: {
        ...iteration,
        cRe: readNumber(params, 'cr', cRe, -JULIA_C_LIMIT, JULIA_C_LIMIT),
        cIm: readNumber(params, 'ci', cIm, -JULIA_C_LIMIT, JULIA_C_LIMIT),
      },
    };
  } else {
    fractal = { kind: 'mandelbrot', params: iteration };
  }

  return {
    fractal,
    view: {
      centerX: readNumber(params, 'x', base.view.centerX, -4, 4),
      centerY: readNumber(params, 'y', base.view.centerY, -4, 4),
      zoomLog: readNumber(params, 'z', base.view.zoomLog, MIN_ZOOM_LOG, MAX_ZOOM_LOG),
    },
    color: {
      palette: hasCustom ? 'custom' : isPaletteId(palette) ? palette : base.color.palette,
      customStops: hasCustom ? customStops : base.color.customStops,
      density: readNumber(params, 'd', base.color.density, 0.05, 20),
      offset: readNumber(params, 'o', base.color.offset, 0, 1),
      edgeShading: readNumber(params, 'e', base.color.edgeShading, 0, 1),
      interior: readHex(params, 'in', base.color.interior),
    },
  };
}
