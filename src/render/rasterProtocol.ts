import type { RasterScene } from '../fractals/types';

/** Main thread → worker: draw `scene` at `width × height` device pixels. */
export interface RasterRequest {
  id: number;
  scene: RasterScene;
  width: number;
  height: number;
}

export interface RasterStats {
  /** Segments drawn (L-systems) or points plotted (IFS). */
  count: number;
  /** A budget cut the figure short. */
  truncated: boolean;
  /** Worker time for this frame: geometry (if rebuilt) plus rasterization. */
  ms: number;
}

/** Worker → main thread. The bitmap is transferred, not copied. */
export type RasterResponse =
  | { id: number; ok: true; bitmap: ImageBitmap; stats: RasterStats }
  | { id: number; ok: false; error: string };
