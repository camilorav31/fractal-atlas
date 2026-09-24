import type { ComplexView, RasterScene } from '../fractals/types';
import type { ExportOptions, RenderEngine, ViewportSize } from './engine';
import { pixelSize } from '../utils/viewMath';
import type { RasterRequest, RasterResponse, RasterStats } from './rasterProtocol';

export interface RasterRendererStats extends RasterStats {
  /** A newer frame is being computed in the worker. */
  rendering: boolean;
}

const MAX_DPR = 2;

interface Frame {
  bitmap: ImageBitmap;
  view: ComplexView;
  width: number;
  height: number;
}

/**
 * Main-thread side of the raster pipeline. The worker is slow for big
 * figures (hundreds of ms), so the screen never waits for it:
 *
 * - **Coalescing**: at most one screen frame is in flight. Changes made while
 *   it renders collapse into a single follow-up request for the latest state.
 * - **Instant preview**: until the fresh frame lands, the last bitmap is
 *   redrawn with the affine transform from its view to the current one, so
 *   pan and zoom track the pointer at display rate.
 *
 * Lifecycle: the worker is spawned on first use and terminated by
 * `suspend`, which frees its thread and its geometry cache (up to ~50 MB)
 * along with the canvas backing store.
 */
export class RasterRenderer implements RenderEngine<RasterScene> {
  private worker: Worker | null = null;
  private suspended = true;
  private devicePixelRatio = 1;
  /** Resolvers waiting for the next screen frame to land (see prepare). */
  private frameWaiters: { resolve(): void; reject(error: Error): void }[] = [];
  private readonly ctx: CanvasRenderingContext2D;
  private scene: RasterScene | null = null;
  private frame: Frame | null = null;
  private inflight: { id: number; view: ComplexView } | null = null;
  private dirty = false;
  private nextId = 1;
  private readonly jobs = new Map<number, { resolve(bitmap: ImageBitmap): void; reject(error: Error): void }>();
  private stats: RasterStats = { count: 0, truncated: false, ms: 0 };
  private cssWidth = 1;
  private cssHeight = 1;

  constructor(
    private readonly canvas: HTMLCanvasElement,
    private readonly onStats: (stats: RasterRendererStats) => void = () => {},
  ) {
    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) throw new Error('Canvas 2D is not supported on this device.');
    this.ctx = ctx;
  }

  setScene(scene: RasterScene): void {
    this.scene = scene;
    this.dirty = true;
    if (this.suspended) return;
    this.drawPreview();
    this.pump();
  }

  /** Shows `scene` and resolves once its first frame is on screen. */
  prepare(scene: RasterScene): Promise<void> {
    const landed = new Promise<void>((resolve, reject) => this.frameWaiters.push({ resolve, reject }));
    this.setScene(scene);
    return landed;
  }

  resume(size: ViewportSize): void {
    this.suspended = false;
    this.resize(size);
  }

  suspend(): void {
    this.suspended = true;
    this.worker?.terminate();
    this.worker = null;
    this.inflight = null;
    this.dirty = true;
    this.frame?.bitmap.close();
    this.frame = null;
    this.failPending(new Error('Raster session suspended'));
    this.canvas.width = 1;
    this.canvas.height = 1;
  }

  resize({ width, height, devicePixelRatio }: ViewportSize): void {
    this.cssWidth = Math.max(1, width);
    this.cssHeight = Math.max(1, height);
    this.devicePixelRatio = Math.min(devicePixelRatio, MAX_DPR);
    if (this.suspended) return; // applied on resume
    this.canvas.width = Math.round(this.cssWidth * this.devicePixelRatio);
    this.canvas.height = Math.round(this.cssHeight * this.devicePixelRatio);
    this.dirty = true;
    this.drawPreview();
    this.pump();
  }

  /** Renders `scene` at an arbitrary size in the worker and returns it on a canvas. */
  async renderImage(scene: RasterScene, width: number, height: number, options: ExportOptions): Promise<HTMLCanvasElement> {
    options.signal?.throwIfAborted();
    const id = this.nextId++;
    const bitmap = await new Promise<ImageBitmap>((resolve, reject) => {
      this.jobs.set(id, { resolve, reject });
      this.post({ id, scene, width, height });
    });
    try {
      options.signal?.throwIfAborted();
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      canvas.getContext('2d')!.drawImage(bitmap, 0, 0);
      options.onProgress?.(1);
      return canvas;
    } finally {
      bitmap.close();
    }
  }

  dispose(): void {
    this.worker?.terminate();
    this.worker = null;
    this.frame?.bitmap.close();
    this.failPending(new Error('Renderer disposed'));
  }

  // --- Worker traffic ---------------------------------------------------------

  /** Spawns the worker on first use (also for exports while suspended). */
  private post(request: RasterRequest): void {
    if (!this.worker) {
      this.worker = new Worker(new URL('../workers/raster.worker.ts', import.meta.url), { type: 'module' });
      this.worker.onmessage = (event: MessageEvent<RasterResponse>) => this.receive(event.data);
    }
    this.worker.postMessage(request);
  }

  private failPending(error: Error): void {
    for (const job of this.jobs.values()) job.reject(error);
    this.jobs.clear();
    for (const waiter of this.frameWaiters) waiter.reject(error);
    this.frameWaiters = [];
  }

  private pump(): void {
    if (this.suspended || this.inflight || !this.dirty || !this.scene) return;
    this.dirty = false;
    const id = this.nextId++;
    this.inflight = { id, view: this.scene.view };
    this.post({ id, scene: this.scene, width: this.canvas.width, height: this.canvas.height });
    this.emit();
  }

  private receive(response: RasterResponse): void {
    const job = this.jobs.get(response.id);
    if (job) {
      this.jobs.delete(response.id);
      if (response.ok) job.resolve(response.bitmap);
      else job.reject(new Error(response.error));
      return;
    }
    if (response.id !== this.inflight?.id) {
      if (response.ok) response.bitmap.close(); // stale
      return;
    }
    const { view } = this.inflight;
    this.inflight = null;
    if (response.ok) {
      this.frame?.bitmap.close();
      this.frame = { bitmap: response.bitmap, view, width: response.bitmap.width, height: response.bitmap.height };
      this.stats = response.stats;
      this.drawPreview();
      const waiters = this.frameWaiters;
      this.frameWaiters = [];
      waiters.forEach((w) => w.resolve());
    } else {
      console.error('L-system render failed:', response.error);
      const waiters = this.frameWaiters;
      this.frameWaiters = [];
      waiters.forEach((w) => w.reject(new Error(response.error)));
    }
    this.pump();
    this.emit();
  }

  private emit(): void {
    this.onStats({ ...this.stats, rendering: this.inflight !== null || this.dirty });
  }

  // --- Drawing -----------------------------------------------------------------

  /** Draws the latest bitmap, re-projected from the view it was rendered for. */
  private drawPreview(): void {
    const { ctx, canvas, scene, frame } = this;
    if (!scene) return;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = scene.color.interior;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    if (!frame) return;

    // Map a pixel of the old frame to where the same plane point sits now.
    const v0 = frame.view;
    const v1 = scene.view;
    const ps0 = pixelSize(v0.zoomLog, frame.height);
    const ps1 = pixelSize(v1.zoomLog, canvas.height);
    const k = ps0 / ps1;
    const tx = canvas.width / 2 + (v0.centerX - v1.centerX) / ps1 - (frame.width / 2) * k;
    const ty = canvas.height / 2 + (v1.centerY - v0.centerY) / ps1 - (frame.height / 2) * k;
    ctx.imageSmoothingQuality = 'high';
    ctx.setTransform(k, 0, 0, k, tx, ty);
    ctx.drawImage(frame.bitmap, 0, 0);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
  }
}
