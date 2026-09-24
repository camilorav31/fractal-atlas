import { useId } from 'react';
import { cx } from './cx';

interface ToggleProps {
  label: string;
  checked: boolean;
  onChange(checked: boolean): void;
  description?: string;
}

export function Toggle({ label, checked, onChange, description }: ToggleProps) {
  const id = useId();
  return (
    <div className="flex items-center justify-between gap-4 py-1.5">
      <label htmlFor={id} className="cursor-pointer">
        <span className="block text-[12px] text-fg-muted">{label}</span>
        {description && <span className="mt-0.5 block text-[11px] text-fg-subtle">{description}</span>}
      </label>
      <button
        id={id}
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={cx(
          'relative h-[18px] w-[30px] shrink-0 rounded-full border transition-colors duration-300 ease-soft',
          checked ? 'border-gilt/50 bg-gilt-soft' : 'border-line-strong bg-white/[0.03]',
        )}
      >
        <span
          className={cx(
            'absolute top-1/2 left-[2px] size-3 -translate-y-1/2 rounded-full transition-all duration-300 ease-out-expo',
            checked ? 'translate-x-3 bg-gilt' : 'bg-fg-subtle',
          )}
        />
      </button>
    </div>
  );
}
