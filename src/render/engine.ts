import type { SceneSnapshot } from '../fractals/types';

export interface ViewportSize {
  /** CSS pixels. */
  width: number;
  height: number;
  devicePixelRatio: number;
}

export interface ExportOptions {
  samples: number;
  onProgress?: (fraction: number) => void;
  signal?: AbortSignal;
}

/**
 * Lifecycle every render pipeline implements, so the session manager can run
 * exactly one at a time:
 *
 *   resume → prepare(scene) → setScene… → suspend → (resume again later)
 *
 * `suspend` releases the heavy resources (GPU buffers, canvas backing
 * stores, worker threads and their caches); `prepare` does whatever is
 * needed before a scene can be shown (compile its shader, produce a first
 * frame) and resolves when it is on screen.
 */
export interface RenderEngine<S extends SceneSnapshot> {
  resume(size: ViewportSize): void;
  suspend(): void;
  prepare(scene: S): Promise<void>;
  setScene(scene: S): void;
  resize(size: ViewportSize): void;
  renderImage(scene: S, width: number, height: number, options: ExportOptions): Promise<HTMLCanvasElement>;
  dispose(): void;
}
