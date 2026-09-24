import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import type { SceneSnapshot } from '../fractals/types';
import { useUiStore } from './uiStore';

export interface Preset {
  id: string;
  name: string;
  createdAt: number;
  snapshot: SceneSnapshot;
  /** Small WebP data URL rendered by the same pipeline as the export. */
  thumbnail: string;
}

interface PresetStore {
  presets: Preset[];
  add(preset: Omit<Preset, 'id' | 'createdAt'>): void;
  rename(id: string, name: string): void;
  remove(id: string): void;
}

/**
 * localStorage that reports quota errors instead of throwing inside
 * zustand's persist middleware (and silently losing the write).
 */
const safeStorage = createJSONStorage(() => ({
  getItem: (key) => localStorage.getItem(key),
  removeItem: (key) => localStorage.removeItem(key),
  setItem: (key, value) => {
    try {
      localStorage.setItem(key, value);
    } catch {
      useUiStore.getState().notify('Storage is full — delete a preset to save new ones.');
    }
  },
}));

export const usePresetStore = create<PresetStore>()(
  persist(
    (set) => ({
      presets: [],
      add: (preset) =>
        set((s) => ({
          presets: [{ ...preset, id: crypto.randomUUID(), createdAt: Date.now() }, ...s.presets],
        })),
      rename: (id, name) => set((s) => ({ presets: s.presets.map((p) => (p.id === id ? { ...p, name } : p)) })),
      remove: (id) => set((s) => ({ presets: s.presets.filter((p) => p.id !== id) })),
    }),
    { name: 'fractal-atlas:presets', version: 1, storage: safeStorage },
  ),
);
