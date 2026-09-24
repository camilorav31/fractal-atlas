import { createContext, useContext } from 'react';
import type { ViewportRenderer } from '../render/ViewportRenderer';
import type { PanZoomController } from '../interaction/PanZoomController';

/** Imperative handles created by the canvas, exposed to panels and shortcuts. */
export interface Viewport {
  renderer: ViewportRenderer;
  controller: PanZoomController;
}

export const ViewportContext = createContext<Viewport | null>(null);

export const useViewport = () => useContext(ViewportContext);
