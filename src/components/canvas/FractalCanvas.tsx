import { useEffect, useRef } from 'react';
import type { Viewport } from '../../app/ViewportContext';
import { FRACTAL_INFO } from '../../fractals/registry';
import { PanZoomController } from '../../interaction/PanZoomController';
import { FractalRenderer } from '../../gl/FractalRenderer';
import { RasterRenderer } from '../../render/RasterRenderer';
import { ViewportRenderer } from '../../render/ViewportRenderer';
import { selectSnapshot, useSceneStore } from '../../store/sceneStore';
import { useUiStore } from '../../store/uiStore';
import { cx } from '../controls/cx';

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

  const loading = useUiStore((s) => s.session?.phase !== 'ready');

  useEffect(() => {
    const surface = surfaceRef.current!;
    const glCanvas = glRef.current!;
    const rasterCanvas = rasterRef.current!;
    const ui = useUiStore.getState();

    // Engines are built lazily by the session manager, the first time a
    // fractal of their family is shown.
    const renderer = new ViewportRenderer(
      {
        escape: (onStats) => new FractalRenderer(glCanvas, onStats),
        raster: (onStats) => new RasterRenderer(rasterCanvas, onStats),
      },
      {
        onStats: ui.setStats,
        onSession: ui.setSession,
        onFamilyChange: (family) => {
          glCanvas.style.visibility = family === 'escape' ? 'visible' : 'hidden';
          rasterCanvas.style.visibility = family === 'raster' ? 'visible' : 'hidden';
        },
      },
    );

    const controller = new PanZoomController(surface, {
      getView: () => useSceneStore.getState().view,
      setView: (view) => useSceneStore.getState().setView(view),
      getSize: () => renderer.viewportSize,
      getMaxZoomLog: () => FRACTAL_INFO[useSceneStore.getState().fractal.kind].maxZoomLog,
    });

    const observer = new ResizeObserver(([entry]) => {
      if (!entry) return;
      const { width, height } = entry.contentRect;
      renderer.resize({ width, height, devicePixelRatio: window.devicePixelRatio });
    });
    observer.observe(surface);
    // Size synchronously too: consumers of onReady may frame the view immediately.
    renderer.resize({ width: surface.clientWidth, height: surface.clientHeight, devicePixelRatio: window.devicePixelRatio });

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
        {/* The image fades out while a session loads and back in once its first frame is up. */}
        <div
          className={cx(
            'absolute inset-0 transition-opacity ease-out-expo',
            loading ? 'opacity-0 duration-150' : 'opacity-100 duration-500',
          )}
        >
          <canvas ref={glRef} className="pointer-events-none invisible absolute inset-0 block size-full" />
          <canvas ref={rasterRef} className="pointer-events-none invisible absolute inset-0 block size-full" />
        </div>
      </div>
    </>
  );
}
