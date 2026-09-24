import { Eye } from 'lucide-react';
import { useEffect, useState } from 'react';
import { FractalCanvas } from '../components/canvas/FractalCanvas';
import { cx } from '../components/controls/cx';
import { Hint } from '../components/hud/Hint';
import { Placard } from '../components/hud/Placard';
import { Readout } from '../components/hud/Readout';
import { Toast } from '../components/hud/Toast';
import { ControlPanel } from '../components/panels/ControlPanel';
import { ExportDialog } from '../components/panels/ExportDialog';
import { useJuliaOrbit } from '../hooks/useJuliaOrbit';
import { useKeyboardShortcuts } from '../hooks/useKeyboardShortcuts';
import { useResetView } from '../hooks/useResetView';
import { useUrlSync } from '../hooks/useUrlSync';
import { openedFromLink } from '../store/sceneStore';
import { useUiStore } from '../store/uiStore';
import { ViewportContext, type Viewport } from './ViewportContext';

export function App() {
  const [viewport, setViewport] = useState<Viewport | null>(null);
  return (
    <ViewportContext.Provider value={viewport}>
      <Atlas onReady={setViewport} viewport={viewport} />
    </ViewportContext.Provider>
  );
}

function Atlas({ onReady, viewport }: { onReady(v: Viewport | null): void; viewport: Viewport | null }) {
  const hidden = useUiStore((s) => s.interfaceHidden);
  const toggleInterface = useUiStore((s) => s.toggleInterface);
  const resetView = useResetView();

  useUrlSync();
  useJuliaOrbit();
  useKeyboardShortcuts(viewport, resetView);

  // First visit (no shared link): frame the whole set beside the panel.
  useEffect(() => {
    if (viewport && !openedFromLink) resetView();
  }, [viewport, resetView]);

  const chrome = cx('transition-all duration-700 ease-out-expo', hidden && 'pointer-events-none opacity-0');

  return (
    <main className="grain">
      <FractalCanvas onReady={onReady} />

      {/* Corner scrims keep the placard and readout legible over bright escape bands. */}
      <div
        aria-hidden
        className={cx(
          'pointer-events-none fixed inset-0 z-[1]',
          'bg-[radial-gradient(ellipse_640px_340px_at_0%_0%,rgb(0_0_0/0.5),transparent_70%),radial-gradient(ellipse_520px_300px_at_0%_100%,rgb(0_0_0/0.5),transparent_70%)]',
          chrome,
        )}
      />

      <div className={cx('fixed top-6 left-6 z-10 md:top-8 md:left-8', chrome)}>
        <Placard />
      </div>

      <div className={cx('fixed bottom-8 left-8 z-10 hidden md:block', chrome)}>
        <Readout />
      </div>

      <div className={cx('fixed bottom-8 left-[calc(50%-172px)] z-10 hidden -translate-x-1/2 xl:block', chrome)}>
        <Hint />
      </div>

      <ControlPanel hidden={hidden} />

      {hidden && (
        <button
          onClick={toggleInterface}
          aria-label="Show interface (H)"
          className="fixed top-4 right-4 z-30 flex size-9 items-center justify-center rounded-full text-fg/0 transition-colors duration-500 hover:bg-black/40 hover:text-fg/80 focus-visible:text-fg/80 [@media(hover:none)]:text-fg/40"
        >
          <Eye size={16} strokeWidth={1.6} />
        </button>
      )}

      <ExportDialog />
      <Toast />
    </main>
  );
}
