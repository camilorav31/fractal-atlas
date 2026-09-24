import { create } from 'zustand';
import type { ColorSettings, ComplexView, MandelbrotParams, SceneSnapshot } from '../fractals/types';
import { decodeScene } from '../utils/urlState';
import { defaultSnapshot } from './defaults';

interface SceneActions {
  setView(view: ComplexView): void;
  setMandelbrot(patch: Partial<MandelbrotParams>): void;
  setColor(patch: Partial<ColorSettings>): void;
  loadSnapshot(snapshot: SceneSnapshot): void;
}

export type SceneStore = SceneSnapshot & SceneActions;

const sceneFromUrl = typeof window === 'undefined' ? null : decodeScene(window.location.search);

/** True when the app opened a shared link; the default view is then left untouched. */
export const openedFromLink = sceneFromUrl !== null;

/**
 * The single source of truth for what is on screen. Rendering subscribes
 * outside React (no re-renders per frame); UI controls subscribe with
 * narrow selectors so a pan doesn't re-render the colour panel.
 */
export const useSceneStore = create<SceneStore>()((set) => ({
  ...(sceneFromUrl ?? defaultSnapshot()),

  setView: (view) => set({ view }),

  setMandelbrot: (patch) =>
    set((s) => ({ fractal: { kind: 'mandelbrot', params: { ...s.fractal.params, ...patch } } })),

  setColor: (patch) => set((s) => ({ color: { ...s.color, ...patch } })),

  loadSnapshot: (snapshot) => set(structuredClone(snapshot)),
}));

export const selectSnapshot = ({ fractal, view, color }: SceneStore): SceneSnapshot => ({ fractal, view, color });
