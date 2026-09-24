import { create } from 'zustand';
import type { ViewportStats } from '../render/ViewportRenderer';

export type PanelTab = 'parameters' | 'presets';

interface Toast {
  id: number;
  message: string;
}

interface UiStore {
  interfaceHidden: boolean;
  panelTab: PanelTab;
  exportOpen: boolean;
  stats: ViewportStats | null;
  toast: Toast | null;
  /** Julia's c is tracing a loop (see useJuliaOrbit). */
  juliaOrbit: boolean;
  /** An L-system is replaying its iterations from the axiom (see useLSystemGrow). */
  lsystemGrowing: boolean;
  toggleInterface(): void;
  setLSystemGrowing(active: boolean): void;
  setJuliaOrbit(active: boolean): void;
  setPanelTab(tab: PanelTab): void;
  setExportOpen(open: boolean): void;
  setStats(stats: ViewportStats): void;
  notify(message: string): void;
}

let toastId = 0;

export const useUiStore = create<UiStore>()((set) => ({
  interfaceHidden: false,
  panelTab: 'parameters',
  exportOpen: false,
  stats: null,
  toast: null,
  juliaOrbit: false,
  lsystemGrowing: false,
  setLSystemGrowing: (lsystemGrowing) => set({ lsystemGrowing }),
  setJuliaOrbit: (juliaOrbit) => set({ juliaOrbit }),
  toggleInterface: () => set((s) => ({ interfaceHidden: !s.interfaceHidden })),
  setPanelTab: (panelTab) => set({ panelTab }),
  setExportOpen: (exportOpen) => set({ exportOpen }),
  setStats: (stats) => set({ stats }),
  notify: (message) => set({ toast: { id: ++toastId, message } }),
}));
