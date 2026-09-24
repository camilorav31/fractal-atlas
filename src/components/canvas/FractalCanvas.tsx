import { useEffect, useRef, useState } from 'react';
import type { Viewport } from '../../app/ViewportContext';
import { FRACTAL_INFO } from '../../fractals/registry';
import { PanZoomController } from '../../interaction/PanZoomController';
import { ViewportRenderer } from '../../render/ViewportRenderer';
import { selectSnapshot, useSceneStore } from '../../store/sceneStore';
import { useUiStore } from '../../store/uiStore';

interface FractalCanvasProps {
  onReady(viewport: Viewport | null): void;
}

/**
 * Mounts the two stacked canvases (WebGL for escape-time fractals, 2D for
 * L-systems) and the pointer surface above them. React renders this once;
 * from then on the renderer is driven by a store subscription outside
 * React, so panning at 120 Hz never causes a component re-render.
 */
export function FractalCanvas({ onReady }: FractalCanvasProps) {
  const surfaceRef = useRef<HTMLDivElement>(null);
  const glRef = useRef<HTMLCanvasElement>(null);
  const rasterRef = useRef<HTMLCanvasElement>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const surface = surfaceRef.current!;
    let renderer: ViewportRenderer;
    try {
      renderer = new ViewportRenderer(glRef.current!, rasterRef.current!, (stats) => useUiStore.getState().setStats(stats));
    } catch (e) {
      console.error(e);
      queueMicrotask(() => setError(e instanceof Error ? e.message : String(e)));
      return;
    }

    const controller = new PanZoomController(surface, {
      getView: () => useSceneStore.getState().view,
      setView: (view) => useSceneStore.getState().setView(view),
      getSize: () => renderer.viewportSize,
      getMaxZoomLog: () => FRACTAL_INFO[useSceneStore.getState().fractal.kind].maxZoomLog,
    });

    const observer = new ResizeObserver(([entry]) => {
      if (!entry) return;
      const { width, height } = entry.contentRect;
      renderer.resize(width, height, window.devicePixelRatio);
    });
    observer.observe(surface);
    // Size synchronously too: consumers of onReady may frame the view immediately.
    renderer.resize(surface.clientWidth, surface.clientHeight, window.devicePixelRatio);

    renderer.setScene(selectSnapshot(useSceneStore.getState()));
    const unsubscribe = useSceneStore.subscribe((state) => renderer.setScene(selectSnapshot(state)));
    onReady({ renderer, controller });

    return () => {
      onReady(null);
      unsubscribe();
      observer.disconnect();
      controller.dispose();
      renderer.dispose();
    };
  }, [onReady]);

  return (
    <>
      <div
        ref={surfaceRef}
        aria-label="Fractal viewport. Scroll to zoom, drag to pan, double-click to dive."
        className="fixed inset-0 cursor-crosshair touch-none select-none data-[dragging]:cursor-grabbing"
      >
        <canvas ref={glRef} className="pointer-events-none absolute inset-0 block size-full" />
        <canvas ref={rasterRef} className="pointer-events-none invisible absolute inset-0 block size-full" />
      </div>
      {error && (
        <div className="fixed inset-0 flex items-center justify-center p-8 text-center">
          <div className="max-w-sm">
            <p className="font-display text-3xl">This device can’t draw the atlas.</p>
            <p className="mt-3 text-fg-muted">{error} Try a recent version of Chrome, Safari, Firefox or Edge.</p>
          </div>
        </div>
      )}
    </>
  );
}
