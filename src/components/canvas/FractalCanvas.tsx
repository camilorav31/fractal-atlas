import { useEffect, useRef, useState } from 'react';
import type { Viewport } from '../../app/ViewportContext';
import { FractalRenderer } from '../../gl/FractalRenderer';
import { PanZoomController } from '../../interaction/PanZoomController';
import { selectSnapshot, useSceneStore } from '../../store/sceneStore';
import { useUiStore } from '../../store/uiStore';

interface FractalCanvasProps {
  onReady(viewport: Viewport | null): void;
}

/**
 * Mounts the WebGL canvas. React renders it once; from then on the renderer
 * is driven by a store subscription outside React, so panning at 120 Hz never
 * causes a component re-render.
 */
export function FractalCanvas({ onReady }: FractalCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current!;
    let renderer: FractalRenderer;
    try {
      renderer = new FractalRenderer(canvas, (stats) => useUiStore.getState().setStats(stats));
    } catch (e) {
      console.error(e);
      queueMicrotask(() => setError(e instanceof Error ? e.message : String(e)));
      return;
    }

    const controller = new PanZoomController(canvas, {
      getView: () => useSceneStore.getState().view,
      setView: (view) => useSceneStore.getState().setView(view),
      getSize: () => renderer.viewportSize,
    });

    const observer = new ResizeObserver(([entry]) => {
      if (!entry) return;
      const { width, height } = entry.contentRect;
      renderer.resize(width, height, window.devicePixelRatio);
    });
    observer.observe(canvas);
    // Size synchronously too: consumers of onReady may frame the view immediately.
    renderer.resize(canvas.clientWidth, canvas.clientHeight, window.devicePixelRatio);

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
      <canvas
        ref={canvasRef}
        aria-label="Fractal viewport. Scroll to zoom, drag to pan, double-click to dive."
        className="fixed inset-0 block size-full cursor-crosshair touch-none select-none data-[dragging]:cursor-grabbing"
      />
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
