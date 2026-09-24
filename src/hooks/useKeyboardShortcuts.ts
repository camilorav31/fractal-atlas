import { useEffect } from 'react';
import type { Viewport } from '../app/ViewportContext';
import { useUiStore } from '../store/uiStore';

const ZOOM_STEP = Math.log10(2);

/** Global shortcuts; ignored while typing in a field or with a dialog open. */
export function useKeyboardShortcuts(viewport: Viewport | null, resetView: () => void): void {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const typing = event.target instanceof Element && event.target.closest('input, textarea, [contenteditable]');
      if (typing || event.metaKey || event.ctrlKey || event.altKey) return;
      const ui = useUiStore.getState();
      if (ui.exportOpen) return;

      switch (event.key.toLowerCase()) {
        case 'h':
          ui.toggleInterface();
          break;
        case 'r':
          resetView();
          break;
        case 'e':
          ui.setExportOpen(true);
          break;
        case '=':
        case '+':
          viewport?.controller.zoomBy(ZOOM_STEP);
          break;
        case '-':
        case '_':
          viewport?.controller.zoomBy(-ZOOM_STEP);
          break;
        default:
          return;
      }
      event.preventDefault();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [viewport, resetView]);
}
