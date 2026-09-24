import { useEffect } from 'react';
import { useSceneStore } from '../store/sceneStore';
import { useUiStore } from '../store/uiStore';

/** Radius of the loop c traces, in complex units. */
const ORBIT_RADIUS = 0.035;
/** Milliseconds per revolution. */
const ORBIT_PERIOD = 14000;

/**
 * While enabled, moves Julia's c around a small circle that passes through
 * its starting value, so the set morphs continuously with no jump at start.
 * Stops by itself if anything else changes c or the fractal.
 */
export function useJuliaOrbit(): void {
  const active = useUiStore((s) => s.juliaOrbit);

  useEffect(() => {
    if (!active) return;
    const start = useSceneStore.getState().fractal;
    if (start.kind !== 'julia') {
      useUiStore.getState().setJuliaOrbit(false);
      return;
    }
    // Circle centred R to the left of c₀, starting at angle 0 = c₀ itself.
    const centreRe = start.params.cRe - ORBIT_RADIUS;
    const centreIm = start.params.cIm;
    let written = { re: start.params.cRe, im: start.params.cIm };
    let phase = 0;
    let previous = performance.now();
    let raf = 0;

    const tick = (now: number) => {
      const { fractal, setJuliaConstant } = useSceneStore.getState();
      if (fractal.kind !== 'julia' || fractal.params.cRe !== written.re || fractal.params.cIm !== written.im) {
        useUiStore.getState().setJuliaOrbit(false);
        return;
      }
      phase += (Math.max(0, now - previous) / ORBIT_PERIOD) * 2 * Math.PI;
      previous = now;
      written = { re: centreRe + ORBIT_RADIUS * Math.cos(phase), im: centreIm + ORBIT_RADIUS * Math.sin(phase) };
      setJuliaConstant(written.re, written.im);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [active]);
}
