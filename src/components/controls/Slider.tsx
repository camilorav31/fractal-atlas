import { useCallback, useId, useRef, type KeyboardEvent, type PointerEvent } from 'react';
import { clamp } from '../../utils/viewMath';
import { cx } from './cx';

export interface SliderProps {
  label: string;
  value: number;
  min: number;
  max: number;
  onChange(value: number): void;
  /** Logarithmic mapping for ranges spanning orders of magnitude (iterations, density). */
  scale?: 'linear' | 'log';
  /** Values are rounded to this step. Omit for continuous. */
  step?: number;
  /** Double-clicking the control restores this value. */
  defaultValue?: number;
  format?: (value: number) => string;
  hint?: string;
}

/**
 * Hairline slider with a mono readout. Click jumps, drag scrubs, Shift+drag
 * scrubs 10× finer; arrow keys step 1% (Shift: 10%); double-click resets.
 */
export function Slider({
  label,
  value,
  min,
  max,
  onChange,
  scale = 'linear',
  step,
  defaultValue,
  format = (v) => v.toFixed(2),
  hint,
}: SliderProps) {
  const id = useId();
  const trackRef = useRef<HTMLDivElement>(null);
  const drag = useRef<{ lastX: number; t: number } | null>(null);

  const toT = useCallback(
    (v: number) =>
      scale === 'log' ? Math.log(v / min) / Math.log(max / min) : (v - min) / (max - min),
    [min, max, scale],
  );
  const fromT = useCallback(
    (t: number) => {
      const tt = clamp(t, 0, 1);
      const raw = scale === 'log' ? min * (max / min) ** tt : min + (max - min) * tt;
      return step ? clamp(Math.round(raw / step) * step, min, max) : raw;
    },
    [min, max, scale, step],
  );

  const t = clamp(toT(value), 0, 1);

  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    const rect = trackRef.current!.getBoundingClientRect();
    e.currentTarget.setPointerCapture(e.pointerId);
    const jump = (e.clientX - rect.left) / rect.width;
    drag.current = { lastX: e.clientX, t: jump };
    onChange(fromT(jump));
  };

  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    if (!drag.current) return;
    const width = trackRef.current!.getBoundingClientRect().width;
    const factor = e.shiftKey ? 0.1 : 1;
    drag.current.t = clamp(drag.current.t + ((e.clientX - drag.current.lastX) / width) * factor, 0, 1);
    drag.current.lastX = e.clientX;
    onChange(fromT(drag.current.t));
  };

  const onKeyDown = (e: KeyboardEvent) => {
    const delta = e.shiftKey ? 0.1 : 0.01;
    const moves: Record<string, number> = {
      ArrowRight: t + delta,
      ArrowUp: t + delta,
      ArrowLeft: t - delta,
      ArrowDown: t - delta,
      Home: 0,
      End: 1,
    };
    const next = moves[e.key];
    if (next === undefined) return;
    e.preventDefault();
    let v = fromT(next);
    // Guarantee progress when the step is coarser than 1% of the range.
    if (step && v === value && e.key.startsWith('Arrow')) {
      v = clamp(value + (next > t ? step : -step), min, max);
    }
    onChange(v);
  };

  return (
    <div className="group py-1.5" onDoubleClick={() => defaultValue !== undefined && onChange(defaultValue)}>
      <div className="mb-2 flex items-baseline justify-between">
        <label htmlFor={id} className="text-[12px] text-fg-muted transition-colors group-hover:text-fg">
          {label}
        </label>
        <span className="font-mono text-[11px] tabular text-fg">{format(value)}</span>
      </div>
      <div
        id={id}
        ref={trackRef}
        role="slider"
        tabIndex={0}
        aria-valuemin={min}
        aria-valuemax={max}
        aria-valuenow={value}
        aria-valuetext={format(value)}
        aria-label={label}
        className="relative flex h-4 cursor-ew-resize touch-none items-center outline-none"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={() => (drag.current = null)}
        onPointerCancel={() => (drag.current = null)}
        onKeyDown={onKeyDown}
      >
        <div className="absolute inset-x-0 h-px bg-line-strong" />
        <div className="absolute left-0 h-px bg-fg/70" style={{ width: `${t * 100}%` }} />
        <div
          className={cx(
            'absolute size-[11px] -translate-x-1/2 rounded-full bg-fg',
            'shadow-[0_0_0_4px_rgb(7_7_10/0.9),0_0_0_5px_rgb(255_255_255/0.08)]',
            'transition-transform duration-200 ease-soft group-hover:scale-110',
            'group-has-[:focus-visible]:shadow-[0_0_0_4px_rgb(7_7_10/0.9),0_0_0_5px_var(--color-gilt)]',
          )}
          style={{ left: `${t * 100}%` }}
        />
      </div>
      {hint && <p className="mt-1.5 text-[11px] text-fg-subtle">{hint}</p>}
    </div>
  );
}
