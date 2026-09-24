import type { ComplexView } from '../fractals/types';
import {
  MAX_ZOOM_LOG,
  MIN_ZOOM_LOG,
  clamp,
  panBy,
  zoomAround,
} from '../utils/viewMath';

export interface PanZoomOptions {
  getView(): ComplexView;
  setView(view: ComplexView): void;
  /** Viewport size in CSS px. */
  getSize(): { width: number; height: number };
  /** Deepest zoom allowed for the current content (log10). */
  getMaxZoomLog(): number;
}

/** Time constants (ms) of the exponential smoothing. Lower = snappier. */
const ZOOM_TAU = 85;
const INERTIA_TAU = 260;
const WHEEL_ZOOM_PER_PIXEL = 0.0016;
const PINCH_WHEEL_ZOOM_PER_PIXEL = 0.012;
const DOUBLE_CLICK_ZOOM = Math.log10(4);

interface ZoomAnimation {
  target: number;
  /** Anchor in CSS px; the complex point beneath it stays fixed while zooming. */
  sx: number;
  sy: number;
}

/**
 * Framework-agnostic pointer, wheel and touch handling for a complex-plane
 * view. Pans follow the pointer 1:1 and coast with inertia on release; wheel
 * and double-click zooms ease exponentially toward a target while keeping
 * the point under the cursor fixed — which is what makes zooming feel
 * "attached" to the fractal rather than to the screen.
 */
export class PanZoomController {
  private pointers = new Map<number, { x: number; y: number }>();
  private lastPinch: { distance: number; mx: number; my: number } | null = null;
  private velocity = { x: 0, y: 0 }; // CSS px per ms
  private moveSamples: { t: number; x: number; y: number }[] = [];
  private zoom: ZoomAnimation | null = null;
  private coasting = false;
  private rafId = 0;
  private lastTick = 0;
  /** The last view this controller wrote; used to detect external changes. */
  private written: ComplexView | null = null;

  constructor(
    private readonly element: HTMLElement,
    private readonly options: PanZoomOptions,
  ) {
    element.addEventListener('wheel', this.onWheel, { passive: false });
    element.addEventListener('pointerdown', this.onPointerDown);
    element.addEventListener('pointermove', this.onPointerMove);
    element.addEventListener('pointerup', this.onPointerUp);
    element.addEventListener('pointercancel', this.onPointerUp);
    element.addEventListener('dblclick', this.onDoubleClick);
  }

  dispose(): void {
    cancelAnimationFrame(this.rafId);
    const el = this.element;
    el.removeEventListener('wheel', this.onWheel);
    el.removeEventListener('pointerdown', this.onPointerDown);
    el.removeEventListener('pointermove', this.onPointerMove);
    el.removeEventListener('pointerup', this.onPointerUp);
    el.removeEventListener('pointercancel', this.onPointerUp);
    el.removeEventListener('dblclick', this.onDoubleClick);
  }

  /** Animated zoom about the viewport centre (keyboard shortcuts, buttons). */
  zoomBy(deltaLog: number): void {
    const { width, height } = this.options.getSize();
    this.startZoom(deltaLog, width / 2, height / 2);
  }

  /** Stops any animation, e.g. before the view is replaced from outside. */
  stop(): void {
    this.zoom = null;
    this.coasting = false;
  }

  // --- Event handlers -------------------------------------------------------

  private onWheel = (event: WheelEvent): void => {
    event.preventDefault();
    const scale = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? 400 : 1;
    // Trackpad pinch arrives as a ctrl+wheel with small deltas.
    const perPixel = event.ctrlKey ? PINCH_WHEEL_ZOOM_PER_PIXEL : WHEEL_ZOOM_PER_PIXEL;
    const { sx, sy } = this.localPoint(event);
    this.startZoom(-event.deltaY * scale * perPixel, sx, sy);
  };

  private onPointerDown = (event: PointerEvent): void => {
    if (event.button !== 0 && event.pointerType === 'mouse') return;
    this.element.setPointerCapture(event.pointerId);
    this.pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    this.coasting = false;
    this.zoom = null;
    this.moveSamples = [];
    this.lastPinch = this.pinchState();
    this.element.dataset.dragging = 'true';
  };

  private onPointerMove = (event: PointerEvent): void => {
    const previous = this.pointers.get(event.pointerId);
    if (!previous) return;
    const current = { x: event.clientX, y: event.clientY };
    this.pointers.set(event.pointerId, current);
    const { height, width } = this.options.getSize();

    if (this.pointers.size === 1) {
      const dx = current.x - previous.x;
      const dy = current.y - previous.y;
      this.write(panBy(this.options.getView(), dx, dy, height));
      this.recordMove(event.timeStamp, dx, dy);
      return;
    }

    // Two fingers: pan with the midpoint, zoom with the spread.
    const pinch = this.pinchState();
    if (pinch && this.lastPinch) {
      const rect = this.element.getBoundingClientRect();
      let view = panBy(this.options.getView(), pinch.mx - this.lastPinch.mx, pinch.my - this.lastPinch.my, height);
      const deltaLog = Math.log10(pinch.distance / this.lastPinch.distance);
      const zoomLog = Math.min(this.options.getMaxZoomLog(), view.zoomLog + deltaLog);
      view = zoomAround(view, pinch.mx - rect.left, pinch.my - rect.top, width, height, zoomLog);
      this.write(view);
    }
    this.lastPinch = pinch;
  };

  private onPointerUp = (event: PointerEvent): void => {
    if (!this.pointers.delete(event.pointerId)) return;
    this.lastPinch = this.pinchState();
    if (this.pointers.size > 0) return;
    delete this.element.dataset.dragging;

    // Release velocity = average over the last ~80 ms of movement.
    const recent = this.moveSamples.filter((s) => event.timeStamp - s.t < 80);
    if (recent.length > 1) {
      const span = Math.max(16, event.timeStamp - recent[0]!.t);
      const sum = recent.reduce((acc, s) => ({ x: acc.x + s.x, y: acc.y + s.y }), { x: 0, y: 0 });
      this.velocity = { x: sum.x / span, y: sum.y / span };
      if (Math.hypot(this.velocity.x, this.velocity.y) > 0.05) {
        this.coasting = true;
        this.ensureTicking();
      }
    }
  };

  private onDoubleClick = (event: MouseEvent): void => {
    const { sx, sy } = this.localPoint(event);
    this.startZoom(event.shiftKey || event.altKey ? -DOUBLE_CLICK_ZOOM : DOUBLE_CLICK_ZOOM, sx, sy);
  };

  // --- Animation ------------------------------------------------------------

  private startZoom(deltaLog: number, sx: number, sy: number): void {
    const base = this.zoom?.target ?? this.options.getView().zoomLog;
    const max = Math.min(MAX_ZOOM_LOG, this.options.getMaxZoomLog());
    this.zoom = { target: clamp(base + deltaLog, MIN_ZOOM_LOG, max), sx, sy };
    this.ensureTicking();
  }

  private ensureTicking(): void {
    if (this.rafId) return;
    this.lastTick = performance.now();
    this.written = this.options.getView();
    this.rafId = requestAnimationFrame(this.tick);
  }

  private tick = (now: number): void => {
    this.rafId = 0;
    const dt = Math.min(64, Math.max(0, now - this.lastTick));
    this.lastTick = now;

    let view = this.options.getView();
    // Someone else (preset, URL, reset) replaced the view: yield to them.
    if (this.written && !sameView(view, this.written)) this.stop();

    const { width, height } = this.options.getSize();

    if (this.coasting) {
      const decay = Math.exp(-dt / INERTIA_TAU);
      view = panBy(view, this.velocity.x * dt, this.velocity.y * dt, height);
      this.velocity.x *= decay;
      this.velocity.y *= decay;
      if (Math.hypot(this.velocity.x, this.velocity.y) < 0.01) this.coasting = false;
    }

    if (this.zoom) {
      const { target, sx, sy } = this.zoom;
      const remaining = target - view.zoomLog;
      const next = Math.abs(remaining) < 1e-4 ? target : view.zoomLog + remaining * (1 - Math.exp(-dt / ZOOM_TAU));
      view = zoomAround(view, sx, sy, width, height, next);
      if (next === target) this.zoom = null;
    }

    if (!sameView(view, this.options.getView())) this.write(view);
    if (this.coasting || this.zoom) this.rafId = requestAnimationFrame(this.tick);
  };

  // --- Helpers --------------------------------------------------------------

  private write(view: ComplexView): void {
    this.written = view;
    this.options.setView(view);
  }

  private recordMove(t: number, x: number, y: number): void {
    this.moveSamples.push({ t, x, y });
    if (this.moveSamples.length > 12) this.moveSamples.shift();
  }

  private pinchState(): { distance: number; mx: number; my: number } | null {
    if (this.pointers.size < 2) return null;
    const [a, b] = [...this.pointers.values()] as [{ x: number; y: number }, { x: number; y: number }];
    return { distance: Math.max(1, Math.hypot(a.x - b.x, a.y - b.y)), mx: (a.x + b.x) / 2, my: (a.y + b.y) / 2 };
  }

  private localPoint(event: MouseEvent): { sx: number; sy: number } {
    const rect = this.element.getBoundingClientRect();
    return { sx: event.clientX - rect.left, sy: event.clientY - rect.top };
  }
}

function sameView(a: ComplexView, b: ComplexView): boolean {
  return a.centerX === b.centerX && a.centerY === b.centerY && a.zoomLog === b.zoomLog;
}
