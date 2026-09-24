import type { ColorSettings, PaletteId } from '../fractals/types';

export interface PaletteDefinition {
  id: PaletteId;
  name: string;
  /** Cyclic stops; the gradient wraps from the last back to the first. */
  stops: readonly string[];
}

/**
 * Curated palettes. Each begins and ends dark so the escape bands read as
 * light emerging from a black field — the look that photographs best.
 */
export const PALETTES: readonly PaletteDefinition[] = [
  { id: 'gilt', name: 'Gilt', stops: ['#07060a', '#2a1f12', '#8f6b30', '#e8cc8a', '#fff7e2', '#6b4f22'] },
  { id: 'obsidian', name: 'Obsidian', stops: ['#000764', '#206bcb', '#edffff', '#ffaa00', '#000200'] },
  { id: 'aurora', name: 'Aurora', stops: ['#03050d', '#0b3a4a', '#1fb39e', '#d5f6e6', '#6b4fd8', '#140b31'] },
  { id: 'ember', name: 'Ember', stops: ['#050203', '#3b0b0b', '#b3261e', '#f28c28', '#ffe7b3', '#2b0d05'] },
  { id: 'nacre', name: 'Nacre', stops: ['#0a0a12', '#3a3e62', '#b6a5d6', '#f4eaf7', '#e7c7a6', '#4c3a52'] },
  { id: 'ink', name: 'Ink', stops: ['#000000', '#1b1b1d', '#8b8b8f', '#f3f3f1', '#4f4f53'] },
];

export const PALETTE_IDS = PALETTES.map((p) => p.id);

export function isPaletteId(value: string): value is PaletteId {
  return (PALETTE_IDS as string[]).includes(value);
}

export function resolveStops(color: Pick<ColorSettings, 'palette' | 'customStops'>): readonly string[] {
  if (color.palette === 'custom') return color.customStops;
  return PALETTES.find((p) => p.id === color.palette)?.stops ?? PALETTES[0]!.stops;
}
