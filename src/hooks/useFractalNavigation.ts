import { useCallback } from 'react';
import { defaultFractalState } from '../fractals/registry';
import type { FractalKind } from '../fractals/types';
import { useSceneStore } from '../store/sceneStore';
import { useUiStore } from '../store/uiStore';
import { useResetView } from './useResetView';

/** Zoom used when jumping to c's location on the Mandelbrot set. */
const LOCATE_ZOOM = 1.4;

/**
 * Moves between fractals, keeping iteration settings and palette. Also the
 * two bridges between the sets: every point of the Mandelbrot plane is a
 * Julia parameter, and every Julia set has a home on the Mandelbrot set.
 */
export function useFractalNavigation() {
  const resetView = useResetView();

  const switchTo = useCallback(
    (kind: FractalKind, juliaConstant?: { cRe: number; cIm: number }) => {
      const scene = useSceneStore.getState();
      const { maxIterations, autoIterations } = scene.fractal.params;
      let next = defaultFractalState(kind, { maxIterations, autoIterations });
      if (next.kind === 'julia' && juliaConstant) next = { kind: 'julia', params: { ...next.params, ...juliaConstant } };
      useUiStore.getState().setJuliaOrbit(false);
      scene.setFractal(next);
      resetView();
    },
    [resetView],
  );

  /** Opens the Julia set whose c is the current Mandelbrot view centre. */
  const juliaAtCentre = useCallback(() => {
    const { view } = useSceneStore.getState();
    switchTo('julia', { cRe: view.centerX, cIm: view.centerY });
  }, [switchTo]);

  /** Shows where the current Julia constant sits on the Mandelbrot set. */
  const locateOnMandelbrot = useCallback(() => {
    const { fractal } = useSceneStore.getState();
    if (fractal.kind !== 'julia') return;
    const { cRe, cIm } = fractal.params;
    switchTo('mandelbrot');
    useSceneStore.getState().setView({ centerX: cRe, centerY: cIm, zoomLog: LOCATE_ZOOM });
  }, [switchTo]);

  return { switchTo, juliaAtCentre, locateOnMandelbrot };
}
