import { useCallback } from 'react';
import { useViewport } from '../app/ViewportContext';
import type { SceneSnapshot } from '../fractals/types';

export const THUMB_WIDTH = 320;
export const THUMB_HEIGHT = 200;

/** Renders any scene offscreen, through the export pipeline, to a data URL. */
export function useRenderToDataUrl() {
  const viewport = useViewport();
  return useCallback(
    async (scene: SceneSnapshot, width: number, height: number, samples = 4): Promise<string> => {
      if (!viewport) throw new Error('Renderer not ready');
      const canvas = await viewport.renderer.renderImage(scene, width, height, { samples });
      return canvas.toDataURL('image/webp', 0.82);
    },
    [viewport],
  );
}

/** Small WebP preview for presets and curated views. */
export function useThumbnail() {
  const render = useRenderToDataUrl();
  return useCallback((scene: SceneSnapshot) => render(scene, THUMB_WIDTH, THUMB_HEIGHT), [render]);
}
