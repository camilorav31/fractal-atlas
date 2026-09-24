import { useEffect } from 'react';
import { useSceneStore } from '../store/sceneStore';
import { useUiStore } from '../store/uiStore';

/** Time each generation stays on screen while growing. */
const STEP_MS = 520;

/**
 * Replays an L-system from its axiom up to the current iteration count, one
 * rewrite per step — the figure visibly grows. Stops by itself if anything
 * else changes the iterations or the fractal.
 */
export function useLSystemGrow(): void {
  const active = useUiStore((s) => s.lsystemGrowing);

  useEffect(() => {
    if (!active) return;
    const { fractal, setLSystem } = useSceneStore.getState();
    if (fractal.kind !== 'lsystem' || fractal.params.iterations === 0) {
      useUiStore.getState().setLSystemGrowing(false);
      return;
    }
    const target = fractal.params.iterations;
    let written = 0;
    setLSystem({ iterations: written });

    const timer = window.setInterval(() => {
      const current = useSceneStore.getState().fractal;
      if (current.kind !== 'lsystem' || current.params.iterations !== written || written >= target) {
        useUiStore.getState().setLSystemGrowing(false);
        return;
      }
      written++;
      useSceneStore.getState().setLSystem({ iterations: written });
    }, STEP_MS);

    return () => {
      window.clearInterval(timer);
      // Interrupted mid-growth: restore the full figure.
      const current = useSceneStore.getState().fractal;
      if (current.kind === 'lsystem' && current.params.iterations === written && written < target) {
        useSceneStore.getState().setLSystem({ iterations: target });
      }
    };
  }, [active]);
}
