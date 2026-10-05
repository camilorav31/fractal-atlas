import type { PaletteId } from '../fractals/types';
import type { SceneSpec } from '../showreel/scenes';
import { needsDoublePrecision } from '../utils/viewMath';
import { ACTS, CHAPTER_FRAMES, ease, lerp, progress, STAGE, type Span } from './timeline';

/**
 * What the film shows behind the motion graphics, as pure functions of time.
 * The overlays import the same functions, so a readout can never drift from
 * the image it describes (the zoom counter reads the same zoom that rendered).
 */

export interface Layer {
  scene: SceneSpec;
  /** Opacity in [0, 1]; layers composite in order (used for palette crossfades). */
  alpha: number;
}

export interface Shot {
  span: Span;
  /** Layers for `local` frames after the shot starts; may exceed the span while the shot is wiped out. */
  layers(local: number): Layer[];
  /** Temporal supersampling for fast camera moves: sub-frames per frame and shutter length in frames. */
  blur?: { samples: number; shutter: number };
}

const single = (scene: SceneSpec): Layer[] => [{ scene, alpha: 1 }];

// --- Act I and V: the whole set, as bookends ----------------------------------

/** The set sits right of centre so the title has the left half of the frame. */
export const introScene = (local: number): SceneSpec => ({
  kind: 'mandelbrot',
  view: { centerX: -1.12, centerY: 0, zoomLog: lerp(-0.12, 0.2, local / ACTS.intro.end) },
  color: { palette: 'gilt', density: 1.2 },
});

export const outroScene = (local: number): SceneSpec => ({
  kind: 'mandelbrot',
  view: { centerX: -0.64, centerY: 0, zoomLog: lerp(0.28, 0.4, local / (ACTS.outro.end - ACTS.outro.start)) },
  color: { palette: 'gilt', density: 1.2 },
});

// --- Act II: one chapter per family -------------------------------------------

export interface Chapter {
  id: 'mandelbrot' | 'julia' | 'lsystem' | 'ifs';
  ordinal: string;
  title: string;
  /** The italic, muted tail of the title. */
  italic: string;
  formula: string;
  /** Put the italic part on its own line (for long titles). */
  stacked?: boolean;
}

export const CHAPTERS: readonly Chapter[] = [
  { id: 'mandelbrot', ordinal: 'Nº 01', title: 'Mandelbrot', italic: 'set', formula: 'zₙ₊₁ = zₙ² + c' },
  { id: 'julia', ordinal: 'Nº 02', title: 'Julia', italic: 'sets', formula: 'zₙ₊₁ = zₙ² + c' },
  { id: 'lsystem', ordinal: 'Nº 03', title: 'L-', italic: 'systems', formula: 'F → F[+F]F[−F]' },
  { id: 'ifs', ordinal: 'Nº 04', title: 'Iterated function', italic: 'systems', formula: 'A = ⋃ wᵢ(A)', stacked: true },
];

const chapterU = (local: number) => local / CHAPTER_FRAMES;

export const mandelbrotZoom = (local: number) => lerp(2.5, 3.7, ease.outCubic(chapterU(local)));
export const mandelbrotChapter = (local: number): SceneSpec => ({
  curated: 'spiral',
  view: { zoomLog: mandelbrotZoom(local) },
});

/** Julia's c travels around a small loop on the Mandelbrot map, as the app's orbit does. */
const JULIA_HOME = { re: -0.123, im: 0.745 };
const JULIA_RADIUS = 0.06;
export function juliaConstant(local: number): { re: number; im: number } {
  const phase = 2 * Math.PI * 0.85 * ease.inOutSine(chapterU(local));
  return {
    re: JULIA_HOME.re - JULIA_RADIUS + JULIA_RADIUS * Math.cos(phase),
    im: JULIA_HOME.im + JULIA_RADIUS * Math.sin(phase),
  };
}
export const juliaChapter = (local: number): SceneSpec => {
  const { re, im } = juliaConstant(local);
  return { curated: 'julia-rabbit', params: { cRe: re, cIm: im }, zoomDelta: 0.05 * chapterU(local) };
};

/** The overview the Julia constant is picked on. */
export const MINIMAP = {
  scene: { kind: 'mandelbrot', view: { centerX: -0.62, centerY: 0, zoomLog: 0.02 }, color: { palette: 'ink', density: 1 } } satisfies SceneSpec,
  width: 520,
  height: 340,
};

export const L_SYSTEM_GENERATIONS = { from: 2, to: 7 };
/** The figure regrows generation by generation, like the app's Grow button. */
export function lsystemGeneration(local: number): number {
  const { from, to } = L_SYSTEM_GENERATIONS;
  const t = ease.outCubic(progress(local, 2, 28));
  return from + Math.min(to - from, Math.floor(t * (to - from + 1)));
}
export const lsystemChapter = (local: number): SceneSpec => ({
  curated: 'lsystem-tree',
  params: { iterations: lsystemGeneration(local), lineWidth: 4.6, glow: 0.55 },
});

export const IFS_POINTS = { from: 1_500, to: 6_000_000 };
/** Chaos-game samples: the fern condenses out of dust, on a log scale. */
export function ifsPoints(local: number): number {
  const t = ease.outCubic(progress(local, 0, 30));
  return Math.round(10 ** lerp(Math.log10(IFS_POINTS.from), Math.log10(IFS_POINTS.to), t));
}
export const ifsChapter = (local: number): SceneSpec => ({
  curated: 'ifs-fern',
  view: { zoomLog: -0.05 },
  params: { points: ifsPoints(local) },
});

// --- Act III: the deep zoom ---------------------------------------------------

export const DIVE = {
  center: { centerX: -0.7436438870371587, centerY: 0.131825904205312 },
  from: 0.3,
  to: 12.2,
  paletteDrift: 0.3,
};
const diveLength = ACTS.dive.end - ACTS.dive.start;

/** Magnification (log10) `local` frames into the dive. */
export const diveZoom = (local: number) => lerp(DIVE.from, DIVE.to, ease.inOutSine(local / diveLength));

export const diveScene = (local: number): SceneSpec => ({
  kind: 'mandelbrot',
  view: { ...DIVE.center, zoomLog: diveZoom(local) },
  color: { palette: 'ember', density: 0.62, offset: (DIVE.paletteDrift * progress(local, 0, diveLength)) % 1 },
});

/** Magnification at which the renderer hands the maths over to emulated double precision. */
export function handoffZoom(): number {
  let zoomLog = 0;
  while (zoomLog < 13 && !needsDoublePrecision({ ...DIVE.center, zoomLog }, STAGE.height)) zoomLog += 0.01;
  return zoomLog;
}

// --- Act IV: palettes ---------------------------------------------------------

export const PALETTE_BEATS: readonly { palette: PaletteId; start: number }[] = [
  { palette: 'gilt', start: 0 },
  { palette: 'obsidian', start: 12 },
  { palette: 'aurora', start: 21 },
  { palette: 'ember', start: 30 },
  { palette: 'nacre', start: 39 },
  { palette: 'ink', start: 48 },
];
const PALETTE_CROSSFADE = 4;

/** Index of the palette showing `local` frames into the act, and how far the crossfade into it has got. */
export function paletteBeat(local: number): { index: number; mix: number } {
  let index = 0;
  PALETTE_BEATS.forEach((beat, i) => {
    if (local >= beat.start) index = i;
  });
  const beat = PALETTE_BEATS[index]!;
  return { index, mix: index === 0 ? 1 : ease.soft(progress(local, beat.start, beat.start + PALETTE_CROSSFADE)) };
}

export const PALETTE_VIEW = { curated: 'seahorse', centerX: -0.7463, centerY: 0.1102 };
const paletteScene = (local: number, palette: PaletteId): SceneSpec => ({
  curated: PALETTE_VIEW.curated,
  zoomDelta: lerp(-0.5, 0, local / (ACTS.palettes.end - ACTS.palettes.start)),
  color: { palette, density: 1.4, offset: (local / 60) % 1 },
});

// --- The reel -----------------------------------------------------------------

const chapterSpan = (index: number): Span => ({
  start: ACTS.families.start + index * CHAPTER_FRAMES,
  end: ACTS.families.start + (index + 1) * CHAPTER_FRAMES,
});

export const SHOTS: readonly Shot[] = [
  { span: ACTS.intro, layers: (local) => single(introScene(local)) },
  { span: chapterSpan(0), layers: (local) => single(mandelbrotChapter(local)) },
  { span: chapterSpan(1), layers: (local) => single(juliaChapter(local)) },
  { span: chapterSpan(2), layers: (local) => single(lsystemChapter(local)) },
  { span: chapterSpan(3), layers: (local) => single(ifsChapter(local)) },
  { span: ACTS.dive, layers: (local) => single(diveScene(local)), blur: { samples: 4, shutter: 0.9 } },
  {
    span: ACTS.palettes,
    layers: (local) => {
      const { index, mix } = paletteBeat(local);
      const current = paletteScene(local, PALETTE_BEATS[index]!.palette);
      if (mix >= 1) return single(current);
      // Mid-crossfade (never on the first beat): the previous palette stays underneath.
      return [{ scene: paletteScene(local, PALETTE_BEATS[index - 1]!.palette), alpha: 1 }, { scene: current, alpha: mix }];
    },
  },
  { span: ACTS.outro, layers: (local) => single(outroScene(local)) },
];

/** Frames the next shot takes to sweep over the previous one. */
export const WIPE_FRAMES = 10;

export interface Wipe {
  from: Shot;
  to: Shot;
  /** Eased sweep position in [0, 1]. */
  progress: number;
}

export function shotAt(frame: number): { shot: Shot; index: number } {
  const index = Math.max(0, SHOTS.findLastIndex((shot) => frame >= shot.span.start));
  return { shot: SHOTS[index]!, index };
}

export function wipeAt(frame: number): Wipe | null {
  const { shot, index } = shotAt(frame);
  const elapsed = frame - shot.span.start;
  if (index === 0 || elapsed >= WIPE_FRAMES) return null;
  return { from: SHOTS[index - 1]!, to: shot, progress: ease.inOut((elapsed + 1) / WIPE_FRAMES) };
}

/** The wipe's edge is slanted; these are its x positions at the top and bottom of the frame. */
export const WIPE_SKEW = 220;
export function wipeEdge(progress: number): { top: number; bottom: number } {
  const top = progress * (STAGE.width + WIPE_SKEW);
  return { top, bottom: top - WIPE_SKEW };
}
