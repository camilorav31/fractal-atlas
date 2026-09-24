import { create } from 'zustand';
import { withIteration } from '../fractals/registry';
import type {
  ColorSettings,
  ComplexView,
  FractalState,
  IterationParams,
  SceneSnapshot,
} from '../fractals/types';
import { decodeScene } from '../utils/urlState';
import { defaultSnapshot } from './defaults';

interface SceneActions {
  setView(view: ComplexView): void;
  /** Replaces the fractal (kind + params). Framing the view is the caller's job. */
  setFractal(fractal: FractalState): void;
  setIteration(patch: Partial<IterationParams>): void;
  /** Sets Julia's c. Ignored when another fractal is active. */
  setJuliaConstant(cRe: number, cIm: number): void;
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

  setFractal: (fractal) => set({ fractal }),

  setIteration: (patch) => set((s) => ({ fractal: withIteration(s.fractal, patch) })),

  setJuliaConstant: (cRe, cIm) =>
    set((s) => (s.fractal.kind === 'julia' ? { fractal: { kind: 'julia', params: { ...s.fractal.params, cRe, cIm } } } : {})),

  setColor: (patch) => set((s) => ({ color: { ...s.color, ...patch } })),

  loadSnapshot: (snapshot) => set(structuredClone(snapshot)),
}));

export const selectSnapshot = ({ fractal, view, color }: SceneStore): SceneSnapshot => ({ fractal, view, color });
