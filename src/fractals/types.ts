/**
 * Domain types shared by every fractal.
 *
 * Each fractal kind carries its own strongly typed parameter object; the
 * `FractalState` discriminated union lets the compiler narrow `params` from
 * `kind`, so a Julia control can never be handed Mandelbrot parameters.
 */

/**
 * A viewport on the plane: the complex plane for escape-time fractals, the
 * turtle's drawing plane for L-systems. Coordinates are float64 on the CPU.
 */
export interface ComplexView {
  centerX: number;
  centerY: number;
  /** log10 of the magnification. 0 shows the whole set; 13 is the df64 limit. */
  zoomLog: number;
}

/** Parameters shared by every escape-time fractal. */
export interface IterationParams {
  /** Base iteration budget. */
  maxIterations: number;
  /** Scale the budget with zoom depth, since deep views need longer orbits. */
  autoIterations: boolean;
}

export type MandelbrotParams = IterationParams;

export interface JuliaParams extends IterationParams {
  /** The constant c in z ← z² + c. Each c defines a different Julia set. */
  cRe: number;
  cIm: number;
}

export type LSystemPresetId =
  | 'plant'
  | 'tree'
  | 'bush'
  | 'koch'
  | 'snowflake'
  | 'dragon'
  | 'sierpinski'
  | 'hilbert';

/** A Lindenmayer system plus the turtle and stroke settings that draw it. */
export interface LSystemParams {
  /** The preset these values came from, or 'custom' once the grammar is edited. */
  preset: LSystemPresetId | 'custom';
  axiom: string;
  /** Production rules, one per line, e.g. "F=FF+[+F-F-F]-[-F+F+F]". */
  rules: string;
  /** Turn angle for + and −, in degrees. */
  angle: number;
  /** Initial turtle heading in degrees (90 = up). */
  heading: number;
  /** Rewriting steps applied to the axiom. */
  iterations: number;
  /** How much strokes thin with each branch level, in [0, 1]. */
  taper: number;
  /** Seeded random variation of angles and lengths, in [0, 1]. */
  jitter: number;
  seed: number;
  /** Colour along the drawing order, or by branch depth. */
  colorBy: 'path' | 'depth';
  /** Stroke width in px per 1000 px of image height. */
  lineWidth: number;
  /** Additive halo around strokes, in [0, 1]. */
  glow: number;
}

/** Fractals computed per pixel in a fragment shader. */
export type EscapeTimeState =
  | { kind: 'mandelbrot'; params: MandelbrotParams }
  | { kind: 'julia'; params: JuliaParams };

/** An affine contraction w(x, y) = (a·x + b·y + e, c·x + d·y + f), picked with probability p. */
export interface AffineMap {
  a: number;
  b: number;
  c: number;
  d: number;
  e: number;
  f: number;
  p: number;
}

export type IFSPresetId = 'fern' | 'maple' | 'tree' | 'sierpinski' | 'spiral' | 'levy' | 'dragon';

/** An iterated function system and how its attractor is exposed. */
export interface IFSParams {
  preset: IFSPresetId | 'custom';
  maps: AffineMap[];
  /** Chaos-game samples per frame at zoom 0 (more when zoomed in). */
  points: number;
  /** Brightness multiplier on the log-density image. */
  exposure: number;
  /** Tone curve applied to log density; higher lifts faint regions. */
  gamma: number;
  /** Colour by which maps built each point, or by density. */
  colorBy: 'map' | 'density';
}

/** Fractals built on the CPU (in a Web Worker) and rasterized to a 2D canvas. */
export type RasterState = { kind: 'lsystem'; params: LSystemParams } | { kind: 'ifs'; params: IFSParams };

export type FractalState = EscapeTimeState | RasterState;

export type EscapeKind = EscapeTimeState['kind'];

export type FractalKind = FractalState['kind'];

export type PaletteId = 'gilt' | 'obsidian' | 'aurora' | 'ember' | 'nacre' | 'ink';

export interface ColorSettings {
  palette: PaletteId | 'custom';
  /** Hex colours (#rrggbb) for the custom gradient, 2–6 stops, cyclic. */
  customStops: string[];
  /** Palette cycles per 32 iterations. */
  density: number;
  /** Palette phase in [0, 1). */
  offset: number;
  /** Strength of the distance-estimate edge shading in [0, 1]. */
  edgeShading: number;
  /** Hex colour of the set's interior. */
  interior: string;
}

/** Everything needed to reproduce an image. Serialized to URLs and presets. */
export interface SceneSnapshot<F extends FractalState = FractalState> {
  fractal: F;
  view: ComplexView;
  color: ColorSettings;
}

export type EscapeScene = SceneSnapshot<EscapeTimeState>;
export type RasterScene = SceneSnapshot<RasterState>;
