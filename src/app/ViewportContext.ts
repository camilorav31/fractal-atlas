import { createContext, useContext } from 'react';
import type { FractalRenderer } from '../gl/FractalRenderer';
import type { PanZoomController } from '../interaction/PanZoomController';

/** Imperative handles created by the canvas, exposed to panels and shortcuts. */
export interface Viewport {
  renderer: FractalRenderer;
  controller: PanZoomController;
}

export const ViewportContext = createContext<Viewport | null>(null);

export const useViewport = () => useContext(ViewportContext);
