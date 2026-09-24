import { useEffect } from 'react';
import { selectSnapshot, useSceneStore } from '../store/sceneStore';
import { encodeScene } from '../utils/urlState';

const DEBOUNCE_MS = 250;

/**
 * Mirrors the scene into the query string. `replaceState` (not push) keeps
 * a zoom session from flooding the back button with hundreds of entries.
 * The initial read happens in the store itself, before the first render.
 */
export function useUrlSync(): void {
  useEffect(() => {
    let timer = 0;
    const unsubscribe = useSceneStore.subscribe((state) => {
      window.clearTimeout(timer);
      timer = window.setTimeout(() => {
        const url = `${window.location.pathname}?${encodeScene(selectSnapshot(state))}`;
        window.history.replaceState(null, '', url);
      }, DEBOUNCE_MS);
    });
    return () => {
      window.clearTimeout(timer);
      unsubscribe();
    };
  }, []);
}
