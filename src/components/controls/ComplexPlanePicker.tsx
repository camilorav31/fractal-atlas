import { useRef, type KeyboardEvent, type PointerEvent, type ReactNode } from 'react';
import type { ComplexView } from '../../fractals/types';
import { complexToScreen, pixelSize, screenToComplex } from '../../utils/viewMath';

interface ComplexPlanePickerProps {
  label: string;
  /** The picked point, in complex-plane coordinates. */
  x: number;
  y: number;
  onChange(x: number, y: number): void;
  /** Region of the plane the picker displays. */
  view: ComplexView;
  /** Width / height of the picker. */
  aspect: number;
  /** Background image of `view`, e.g. a rendered Mandelbrot set. */
  image: string | null;
  /** Overlay rendered in the bottom-left corner. */
  caption?: ReactNode;
}

/** Nominal height for keyboard step sizes; the picker scales with its container. */
const NOMINAL_HEIGHT = 180;

/**
 * Picks a point on a region of the complex plane. Click jumps, drag scrubs,
 * Shift+drag scrubs 10× finer; arrow keys nudge (Shift: finer).
 */
export function ComplexPlanePicker({ label, x, y, onChange, view, aspect, image, caption }: ComplexPlanePickerProps) {
  const ref = useRef<HTMLDivElement>(null);
  const drag = useRef<{ lastX: number; lastY: number } | null>(null);

  const toComplex = (clientX: number, clientY: number) => {
    const rect = ref.current!.getBoundingClientRect();
    return screenToComplex(view, clientX - rect.left, clientY - rect.top, rect.width, rect.height);
  };

  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = { lastX: e.clientX, lastY: e.clientY };
    const p = toComplex(e.clientX, e.clientY);
    onChange(p.x, p.y);
  };

  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    if (!drag.current) return;
    const rect = ref.current!.getBoundingClientRect();
    const ps = pixelSize(view.zoomLog, rect.height) * (e.shiftKey ? 0.1 : 1);
    const dx = e.clientX - drag.current.lastX;
    const dy = e.clientY - drag.current.lastY;
    drag.current = { lastX: e.clientX, lastY: e.clientY };
    onChange(x + dx * ps, y - dy * ps);
  };

  const onKeyDown = (e: KeyboardEvent) => {
    const step = pixelSize(view.zoomLog, NOMINAL_HEIGHT) * (e.shiftKey ? 0.25 : 2);
    const moves: Record<string, [number, number]> = {
      ArrowLeft: [-step, 0],
      ArrowRight: [step, 0],
      ArrowUp: [0, step],
      ArrowDown: [0, -step],
    };
    const move = moves[e.key];
    if (!move) return;
    e.preventDefault();
    onChange(x + move[0], y + move[1]);
  };

  const { sx, sy } = complexToScreen(view, x, y, aspect, 1);
  const left = `${(sx / aspect) * 100}%`;
  const top = `${sy * 100}%`;

  return (
    <div
      ref={ref}
      role="slider"
      tabIndex={0}
      aria-label={label}
      aria-valuetext={`${x.toFixed(4)} ${y < 0 ? '−' : '+'} ${Math.abs(y).toFixed(4)}i`}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={() => (drag.current = null)}
      onPointerCancel={() => (drag.current = null)}
      onKeyDown={onKeyDown}
      className="group relative cursor-crosshair touch-none overflow-hidden rounded-[11px] bg-black/40 shadow-[inset_0_0_0_1px_rgb(255_255_255/0.08)] outline-none select-none focus-visible:shadow-[inset_0_0_0_1px_var(--color-gilt)]"
      style={{ aspectRatio: String(aspect) }}
    >
      {image ? (
        <img src={image} alt="" draggable={false} className="animate-rise pointer-events-none absolute inset-0 size-full" />
      ) : (
        <span className="absolute inset-0 animate-pulse bg-white/[0.03]" />
      )}

      {/* Crosshair */}
      <span className="pointer-events-none absolute inset-x-0 h-px bg-white/20" style={{ top }} />
      <span className="pointer-events-none absolute inset-y-0 w-px bg-white/20" style={{ left }} />
      <span
        className="pointer-events-none absolute size-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-[1.5px] border-gilt bg-black/40 shadow-[0_0_0_3px_rgb(0_0_0/0.35),0_0_14px_rgb(217_191_133/0.7)] transition-transform duration-200 group-active:scale-90"
        style={{ left, top }}
      />

      {caption && (
        <span className="hud-shadow pointer-events-none absolute bottom-2 left-2.5 font-mono text-[10px] tabular text-fg/85">
          {caption}
        </span>
      )}
    </div>
  );
}
