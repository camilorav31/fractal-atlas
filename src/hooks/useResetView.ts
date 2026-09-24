import { useCallback } from 'react';
import { useViewport } from '../app/ViewportContext';
import { FRACTALS } from '../fractals/registry';
import { useSceneStore } from '../store/sceneStore';
import { useUiStore } from '../store/uiStore';
import { frameInSafeArea, type Insets } from '../utils/viewMath';

export const CONTROL_PANEL_ID = 'control-panel';

/** Measures how much of the viewport the control panel covers. */
function panelInsets(): Insets {
  const panel = document.getElementById(CONTROL_PANEL_ID);
  if (!panel || useUiStore.getState().interfaceHidden) return { right: 0, bottom: 0 };
  const rect = panel.getBoundingClientRect();
  // Mirrors the `md` breakpoint in ControlPanel: side panel above it, bottom sheet below.
  const docked = window.matchMedia('(min-width: 768px)').matches;
  return docked
    ? { right: Math.max(0, window.innerWidth - rect.left), bottom: 0 }
    : { right: 0, bottom: Math.max(0, window.innerHeight - rect.top) };
}

/** Returns a function that frames the fractal's default view around the UI. */
export function useResetView() {
  const viewport = useViewport();
  return useCallback(() => {
    const kind = useSceneStore.getState().fractal.kind;
    const { width, height } = viewport?.renderer.viewportSize ?? { width: innerWidth, height: innerHeight };
    viewport?.controller.stop();
    useSceneStore.getState().setView(frameInSafeArea(FRACTALS[kind].defaultView, width, height, panelInsets()));
  }, [viewport]);
}
