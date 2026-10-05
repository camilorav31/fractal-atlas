import type { CSSProperties, ReactNode } from 'react';
import { cx } from '../components/controls/cx';
import { clamp01 } from './timeline';

/**
 * Text that rises out of a mask and sinks back into it. `shown` 0 → 1 brings it
 * in from below; `gone` 0 → 1 sends it out through the top. The padding gives
 * descenders room inside the clip and the negative margins give it back.
 */
export function Mask({
  shown,
  gone = 0,
  className,
  children,
}: {
  shown: number;
  gone?: number;
  className?: string;
  children: ReactNode;
}) {
  const y = (1 - shown) * 108 - gone * 108;
  return (
    <div className={cx('-mt-[0.08em] -mb-[0.2em] overflow-hidden pt-[0.08em] pb-[0.2em]', className)}>
      <div style={{ transform: `translateY(${y}%)` }}>{children}</div>
    </div>
  );
}

/** Small uppercase label, the film's counterpart of the app's `eyebrow`. */
export function Eyebrow({ className, style, children }: { className?: string; style?: CSSProperties; children: ReactNode }) {
  return (
    <div
      className={cx('flex items-center gap-4 font-sans text-[15px] font-medium tracking-[0.24em] text-fg-muted uppercase', className)}
      style={style}
    >
      {children}
    </div>
  );
}

/** A rule that draws itself left to right. */
export function Hairline({ p, width, from = 'left', className }: { p: number; width: number; from?: 'left' | 'center'; className?: string }) {
  return (
    <div
      className={cx('h-px bg-fg/30', className)}
      style={{ width, transform: `scaleX(${clamp01(p)})`, transformOrigin: from === 'left' ? '0 50%' : '50% 50%' }}
    />
  );
}

/** Mono text revealed one character at a time, with a block cursor while it types. */
export function Typed({ text, p }: { text: string; p: number }) {
  const count = Math.floor(clamp01(p) * text.length);
  return (
    <>
      {text.slice(0, count)}
      {p > 0 && p < 1 && <span className="ml-[3px] inline-block h-[1em] w-[2px] translate-y-[0.14em] bg-gilt" />}
    </>
  );
}

/** Mono label / value pair, as in the app's readout. */
export function Row({ label, children, style }: { label: string; children: ReactNode; style?: CSSProperties }) {
  return (
    <div className="grid grid-cols-[150px_1fr] items-baseline gap-x-6" style={style}>
      <dt className="text-fg-muted">{label}</dt>
      <dd className="text-fg/95">{children}</dd>
    </div>
  );
}

/** Magnification as "×10" with a raised exponent. */
export function Magnification({ zoomLog, digits = 2 }: { zoomLog: number; digits?: number }) {
  return (
    <>
      ×10<sup className="ml-[2px] text-[0.62em]">{zoomLog.toFixed(digits)}</sup>
    </>
  );
}

/** Tick-box chip, like the app's precision badge. */
export function Badge({ active = false, children, className }: { active?: boolean; children: ReactNode; className?: string }) {
  return (
    <span
      className={cx(
        'rounded-[5px] border px-2.5 py-[3px] font-mono text-[14px] tracking-[0.14em] uppercase',
        active ? 'border-gilt/60 text-gilt' : 'border-fg/25 text-fg-muted',
        className,
      )}
    >
      {children}
    </span>
  );
}
