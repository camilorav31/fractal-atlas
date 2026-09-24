import type { LSystemParams, LSystemPresetId } from '../types';

export interface LSystemPreset extends Omit<LSystemParams, 'preset' | 'seed' | 'glow'> {
  id: LSystemPresetId;
  name: string;
}

/**
 * Classic systems, mostly from Prusinkiewicz & Lindenmayer (1990). Plants
 * start pointing up (heading 90°); curves start pointing right.
 */
export const LSYSTEM_PRESETS: readonly LSystemPreset[] = [
  {
    id: 'plant',
    name: 'Fractal plant',
    axiom: 'X',
    rules: 'X=F+[[X]-X]-F[-FX]+X\nF=FF',
    angle: 25,
    heading: 70,
    iterations: 6,
    taper: 0.5,
    jitter: 0.15,
    colorBy: 'depth',
    lineWidth: 2.2,
  },
  {
    id: 'tree',
    name: 'Tree',
    axiom: 'X',
    rules: 'X=F[+X]F[-X]+X\nF=FF',
    angle: 20,
    heading: 90,
    iterations: 7,
    taper: 0.6,
    jitter: 0.2,
    colorBy: 'depth',
    lineWidth: 3.0,
  },
  {
    id: 'bush',
    name: 'Bush',
    axiom: 'F',
    rules: 'F=FF+[+F-F-F]-[-F+F+F]',
    angle: 22.5,
    heading: 90,
    iterations: 4,
    taper: 0.55,
    jitter: 0.1,
    colorBy: 'depth',
    lineWidth: 2.6,
  },
  {
    id: 'koch',
    name: 'Koch curve',
    axiom: 'F',
    rules: 'F=F+F--F+F',
    angle: 60,
    heading: 0,
    iterations: 5,
    taper: 0,
    jitter: 0,
    colorBy: 'path',
    lineWidth: 1.8,
  },
  {
    id: 'snowflake',
    name: 'Koch snowflake',
    axiom: 'F--F--F',
    rules: 'F=F+F--F+F',
    angle: 60,
    heading: 0,
    iterations: 5,
    taper: 0,
    jitter: 0,
    colorBy: 'path',
    lineWidth: 1.8,
  },
  {
    id: 'dragon',
    name: 'Dragon curve',
    axiom: 'FX',
    rules: 'X=X+YF+\nY=-FX-Y',
    angle: 90,
    heading: 0,
    iterations: 13,
    taper: 0,
    jitter: 0,
    colorBy: 'path',
    lineWidth: 1.4,
  },
  {
    id: 'sierpinski',
    name: 'Sierpiński arrowhead',
    axiom: 'A',
    rules: 'A=B-A-B\nB=A+B+A',
    angle: 60,
    heading: 0,
    iterations: 7,
    taper: 0,
    jitter: 0,
    colorBy: 'path',
    lineWidth: 1.5,
  },
  {
    id: 'hilbert',
    name: 'Hilbert curve',
    axiom: 'X',
    rules: 'X=+YF-XFX-FY+\nY=-XF+YFY+FX-',
    angle: 90,
    heading: 0,
    iterations: 5,
    taper: 0,
    jitter: 0,
    colorBy: 'path',
    lineWidth: 1.8,
  },
];

export function paramsFromPreset(preset: LSystemPreset, keep?: Pick<LSystemParams, 'seed' | 'glow'>): LSystemParams {
  const { id, axiom, rules, angle, heading, iterations, taper, jitter, colorBy, lineWidth } = preset;
  return {
    preset: id,
    axiom,
    rules,
    angle,
    heading,
    iterations,
    taper,
    jitter,
    colorBy,
    lineWidth,
    seed: keep?.seed ?? 7,
    glow: keep?.glow ?? 0.35,
  };
}

export const findPreset = (id: string) => LSYSTEM_PRESETS.find((p) => p.id === id);
