/**
 * Domain types shared by every fractal.
 *
 * Each fractal kind carries its own strongly typed parameter object; the
 * `FractalState` discriminated union lets the compiler narrow `params` from
 * `kind`, so a Julia control can never be handed Mandelbrot parameters.
 */

/** A viewport on the complex plane. Coordinates are float64 on the CPU. */
export interface ComplexView {
  centerX: number;
  centerY: number;
  /** log10 of the magnification. 0 shows the whole set; 13 is the df64 limit. */
  zoomLog: number;
}

export interface MandelbrotParams {
  /** Base iteration budget. */
  maxIterations: number;
  /** Scale the budget with zoom depth, since deep views need longer orbits. */
  autoIterations: boolean;
}

export type FractalState = { kind: 'mandelbrot'; params: MandelbrotParams };

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
export interface SceneSnapshot {
  fractal: FractalState;
  view: ComplexView;
  color: ColorSettings;
}
