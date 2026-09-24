import { useEffect, useState } from 'react';
import { useUiStore } from '../../store/uiStore';
import { cx } from '../controls/cx';

export function Toast() {
  const toast = useUiStore((s) => s.toast);
  const [visibleId, setVisibleId] = useState<number | null>(null);

  useEffect(() => {
    if (!toast) return;
    const show = window.setTimeout(() => setVisibleId(toast.id), 0);
    const hide = window.setTimeout(() => setVisibleId(null), 2600);
    return () => {
      window.clearTimeout(show);
      window.clearTimeout(hide);
    };
  }, [toast]);

  const visible = toast !== null && visibleId === toast.id;
  return (
    <div
      role="status"
      aria-live="polite"
      className={cx(
        'glass pointer-events-none fixed top-5 left-1/2 z-50 -translate-x-1/2 rounded-full px-4 py-2 text-[12px] text-fg',
        'transition-all duration-500 ease-out-expo',
        visible ? 'translate-y-0 opacity-100' : '-translate-y-2 opacity-0',
      )}
    >
      {toast?.message}
    </div>
  );
}
