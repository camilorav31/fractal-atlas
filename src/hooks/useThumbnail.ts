import { useCallback } from 'react';
import { useViewport } from '../app/ViewportContext';
import type { SceneSnapshot } from '../fractals/types';

export const THUMB_WIDTH = 320;
export const THUMB_HEIGHT = 200;

/** Renders a small WebP preview of a scene through the export pipeline. */
export function useThumbnail() {
  const viewport = useViewport();
  return useCallback(
    async (scene: SceneSnapshot): Promise<string> => {
      if (!viewport) throw new Error('Renderer not ready');
      const canvas = await viewport.renderer.renderImage(scene, THUMB_WIDTH, THUMB_HEIGHT, { samples: 4 });
      return canvas.toDataURL('image/webp', 0.82);
    },
    [viewport],
  );
}
