import { JULIA_C_LIMIT } from '../fractals/julia';
import { MAX_ITERATIONS, MIN_ITERATIONS } from '../fractals/iterations';
import { MAX_LSYSTEM_ITERATIONS, maxIterationsWithinBudget, parseRules, validateAxiom } from '../fractals/lsystem/grammar';
import { decodeMaps, encodeMaps } from '../fractals/ifs/maps';
import { DEFAULT_IFS_RENDER, findIFSPreset } from '../fractals/ifs/presets';
import { findPreset } from '../fractals/lsystem/presets';
import { FRACTAL_INFO, isEscapeState, isFractalKind } from '../fractals/registry';
import type { FractalState, IFSParams, LSystemParams, SceneSnapshot } from '../fractals/types';
import { defaultSnapshot } from '../store/defaults';
import { isHexColor } from './color';
import { isPaletteId } from './palettes';
import { MAX_ZOOM_LOG, MIN_ZOOM_LOG, clamp } from './viewMath';

/**
 * Scene ⇄ query string. Short keys keep shared links readable:
 *
 *   ?f=mandelbrot&x=-0.7436438870371&y=0.1318259042&z=9.2&it=400&p=gilt
 *   ?f=julia&cr=-0.8&ci=0.156&x=0&y=0&z=0&p=nacre
 *   ?f=ifs&is=fern&pt=3000000&ex=1.4&gm=2.2
 *   ?f=lsystem&ls=plant&ax=X&ru=X%3DF%2B[[X]-X]-F[-FX]%2BX%0AF%3DFF&an=25&n=6
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
  });
  if (isEscapeState(fractal)) {
    params.set('it', String(fractal.params.maxIterations));
    params.set('ai', fractal.params.autoIterations ? '1' : '0');
  }
  if (fractal.kind === 'julia') {
    params.set('cr', trimNumber(fractal.params.cRe, 15));
    params.set('ci', trimNumber(fractal.params.cIm, 15));
  }
  if (fractal.kind === 'lsystem') {
    const l = fractal.params;
    params.set('ls', l.preset);
    // Presets are reconstructed from their id; only custom grammars travel in full.
    if (l.preset === 'custom') {
      params.set('ax', l.axiom);
      params.set('ru', l.rules);
      params.set('hd', trimNumber(l.heading, 6));
    }
    params.set('an', trimNumber(l.angle, 6));
    params.set('n', String(l.iterations));
    params.set('tp', l.taper.toFixed(2));
    params.set('jt', l.jitter.toFixed(2));
    params.set('sd', String(l.seed));
    params.set('cb', l.colorBy);
    params.set('lw', l.lineWidth.toFixed(2));
    params.set('gl', l.glow.toFixed(2));
  }
  if (fractal.kind === 'ifs') {
    const f = fractal.params;
    params.set('is', f.preset);
    // As with L-systems, a preset travels as its id; custom maps travel in full.
    if (f.preset === 'custom') params.set('mp', encodeMaps(f.maps));
    params.set('pt', String(f.points));
    params.set('ex', f.exposure.toFixed(2));
    params.set('gm', f.gamma.toFixed(2));
    params.set('cb', f.colorBy);
  }
  params.set('p', color.palette);
  params.set('d', color.density.toFixed(3));
  params.set('o', color.offset.toFixed(3));
  params.set('e', color.edgeShading.toFixed(2));
  params.set('in', stripHash(color.interior));
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

  const fractal = decodeFractal(params, base.fractal);
  return {
    fractal,
    view: {
      centerX: readNumber(params, 'x', base.view.centerX, -4, 4),
      centerY: readNumber(params, 'y', base.view.centerY, -4, 4),
      zoomLog: readNumber(params, 'z', base.view.zoomLog, MIN_ZOOM_LOG, Math.min(MAX_ZOOM_LOG, FRACTAL_INFO[kind].maxZoomLog)),
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

function decodeFractal(params: URLSearchParams, base: FractalState): FractalState {
  if (base.kind === 'lsystem') return { kind: 'lsystem', params: decodeLSystem(params, base.params) };
  if (base.kind === 'ifs') return { kind: 'ifs', params: decodeIFS(params, base.params) };

  const iteration = {
    maxIterations: Math.round(readNumber(params, 'it', base.params.maxIterations, MIN_ITERATIONS, MAX_ITERATIONS)),
    autoIterations: params.get('ai') !== '0',
  };
  if (base.kind === 'julia') {
    return {
      kind: 'julia',
      params: {
        ...iteration,
        cRe: readNumber(params, 'cr', base.params.cRe, -JULIA_C_LIMIT, JULIA_C_LIMIT),
        cIm: readNumber(params, 'ci', base.params.cIm, -JULIA_C_LIMIT, JULIA_C_LIMIT),
      },
    };
  }
  return { kind: 'mandelbrot', params: iteration };
}

function decodeLSystem(params: URLSearchParams, base: LSystemParams): LSystemParams {
  const preset = findPreset(params.get('ls') ?? '');
  // A preset id restores its grammar; a custom grammar must parse cleanly or we fall back.
  let grammar: Pick<LSystemParams, 'preset' | 'axiom' | 'rules' | 'heading'> = preset
    ? { preset: preset.id, axiom: preset.axiom, rules: preset.rules, heading: preset.heading }
    : { preset: base.preset, axiom: base.axiom, rules: base.rules, heading: base.heading };
  if (params.get('ls') === 'custom') {
    const axiom = params.get('ax') ?? '';
    const rules = params.get('ru') ?? '';
    if (validateAxiom(axiom) === null && parseRules(rules).ok) {
      grammar = { preset: 'custom', axiom, rules, heading: readNumber(params, 'hd', base.heading, -360, 360) };
    }
  }
  const defaults = preset ?? base;
  const parsed = parseRules(grammar.rules);
  const budget = parsed.ok ? maxIterationsWithinBudget(grammar.axiom, parsed.rules) : MAX_LSYSTEM_ITERATIONS;
  return {
    ...grammar,
    angle: readNumber(params, 'an', defaults.angle, 0.1, 180),
    iterations: Math.round(readNumber(params, 'n', defaults.iterations, 0, budget)),
    taper: readNumber(params, 'tp', defaults.taper, 0, 1),
    jitter: readNumber(params, 'jt', defaults.jitter, 0, 1),
    seed: Math.round(readNumber(params, 'sd', base.seed, 0, 2 ** 31)),
    colorBy: params.get('cb') === 'path' ? 'path' : params.get('cb') === 'depth' ? 'depth' : defaults.colorBy,
    lineWidth: readNumber(params, 'lw', defaults.lineWidth, 0.1, 12),
    glow: readNumber(params, 'gl', base.glow, 0, 1),
  };
}

/** Upper bound on chaos-game samples a link may request (keeps frames under ~1 s). */
const MAX_IFS_POINTS = 12_000_000;

function decodeIFS(params: URLSearchParams, base: IFSParams): IFSParams {
  const preset = findIFSPreset(params.get('is') ?? '');
  const custom = params.get('is') === 'custom' ? decodeMaps(params.get('mp') ?? '') : null;
  const maps = custom ?? (preset ?? { maps: base.maps }).maps.map((m) => ({ ...m }));
  const cb = params.get('cb');
  return {
    preset: custom ? 'custom' : (preset?.id ?? base.preset),
    maps,
    points: Math.round(readNumber(params, 'pt', DEFAULT_IFS_RENDER.points, 100_000, MAX_IFS_POINTS)),
    exposure: readNumber(params, 'ex', DEFAULT_IFS_RENDER.exposure, 0.1, 8),
    gamma: readNumber(params, 'gm', DEFAULT_IFS_RENDER.gamma, 0.5, 6),
    colorBy: cb === 'map' || cb === 'density' ? cb : (preset?.colorBy ?? base.colorBy),
  };
}
