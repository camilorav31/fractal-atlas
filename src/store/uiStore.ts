import { create } from 'zustand';
import type { RenderStats } from '../gl/FractalRenderer';

export type PanelTab = 'parameters' | 'presets';

interface Toast {
  id: number;
  message: string;
}

interface UiStore {
  interfaceHidden: boolean;
  panelTab: PanelTab;
  exportOpen: boolean;
  stats: RenderStats | null;
  toast: Toast | null;
  toggleInterface(): void;
  setPanelTab(tab: PanelTab): void;
  setExportOpen(open: boolean): void;
  setStats(stats: RenderStats): void;
  notify(message: string): void;
}

let toastId = 0;

export const useUiStore = create<UiStore>()((set) => ({
  interfaceHidden: false,
  panelTab: 'parameters',
  exportOpen: false,
  stats: null,
  toast: null,
  toggleInterface: () => set((s) => ({ interfaceHidden: !s.interfaceHidden })),
  setPanelTab: (panelTab) => set({ panelTab }),
  setExportOpen: (exportOpen) => set({ exportOpen }),
  setStats: (stats) => set({ stats }),
  notify: (message) => set({ toast: { id: ++toastId, message } }),
}));
