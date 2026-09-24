import { useEffect, useState, type ReactNode } from 'react';
import { FRACTAL_INFO } from '../../fractals/registry';
import { useUiStore } from '../../store/uiStore';
import { cx } from '../controls/cx';

/** Loads faster than this never show the indicator — no flash on quick switches. */
const SHOW_DELAY_MS = 160;

/**
 * Shown while a render session starts: shader compilation, worker start-up,
 * first frame. Centred in the area beside the panel.
 */
export function SessionLoader() {
  const session = useUiStore((s) => s.session);
  const loading = session?.phase === 'loading';
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!loading) return;
    const timer = window.setTimeout(() => setVisible(true), SHOW_DELAY_MS);
    return () => {
      window.clearTimeout(timer);
      setVisible(false);
    };
  }, [loading, session?.kind]);

  if (session?.phase === 'error') {
    return (
      <Centered>
        <div className="glass animate-rise max-w-sm rounded-[18px] px-6 py-5 text-center">
          <p className="font-display text-[26px] leading-tight">This view couldn’t start.</p>
          <p className="mt-2 text-[12px] leading-relaxed text-fg-muted">{session.message}</p>
          <p className="mt-3 text-[11px] text-fg-subtle">Try another fractal, or a recent Chrome, Safari, Firefox or Edge.</p>
        </div>
      </Centered>
    );
  }

  const show = loading && visible;
  return (
    <Centered>
      <div
        role="status"
        aria-live="polite"
        className={cx(
          'flex flex-col items-center gap-3 transition-all duration-500 ease-out-expo',
          show ? 'translate-y-0 opacity-100' : 'translate-y-1 opacity-0',
        )}
      >
        <svg viewBox="0 0 40 40" className="size-9 animate-spin [animation-duration:1.4s]" aria-hidden>
          <circle cx="20" cy="20" r="16" fill="none" stroke="rgb(255 255 255 / 0.08)" strokeWidth="1.5" />
          <circle
            cx="20"
            cy="20"
            r="16"
            fill="none"
            stroke="var(--color-gilt)"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeDasharray="28 100"
          />
        </svg>
        {session?.phase === 'loading' && (
          <div className="hud-shadow text-center">
            <p className="font-display text-[22px] leading-none text-fg">{FRACTAL_INFO[session.kind].title}</p>
            <p className="mt-2 font-mono text-[10px] tracking-[0.14em] text-fg-muted uppercase">{session.task}…</p>
          </div>
        )}
      </div>
    </Centered>
  );
}

function Centered({ children }: { children: ReactNode }) {
  return (
    <div className="pointer-events-none fixed inset-0 z-[5] flex items-center justify-center md:right-[344px]">
      {children}
    </div>
  );
}
