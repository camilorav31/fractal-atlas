import { useState } from 'react';
import { clamp } from '../../utils/viewMath';

interface NumberFieldProps {
  label: string;
  value: number;
  onChange(value: number): void;
  min: number;
  max: number;
  /** Digits shown while not editing. */
  digits?: number;
}

/**
 * Compact mono number input. Edits are committed on Enter or blur; invalid
 * text reverts, out-of-range values clamp.
 */
export function NumberField({ label, value, onChange, min, max, digits = 6 }: NumberFieldProps) {
  const [draft, setDraft] = useState<string | null>(null);

  const commit = () => {
    if (draft === null) return;
    const parsed = Number(draft.replace('−', '-'));
    if (draft.trim() !== '' && Number.isFinite(parsed)) onChange(clamp(parsed, min, max));
    setDraft(null);
  };

  return (
    <label className="flex h-8 min-w-0 flex-1 items-center gap-2 rounded-[9px] border border-line-strong bg-black/25 px-2.5 focus-within:border-gilt/50">
      <span className="text-[10px] tracking-[0.12em] text-fg-subtle uppercase">{label}</span>
      <input
        inputMode="decimal"
        spellCheck={false}
        aria-label={label}
        value={draft ?? value.toFixed(digits)}
        onFocus={(e) => {
          setDraft(value.toFixed(digits));
          e.currentTarget.select();
        }}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') e.currentTarget.blur();
          if (e.key === 'Escape') {
            setDraft(null);
            e.currentTarget.blur();
          }
        }}
        className="w-full min-w-0 bg-transparent text-right font-mono text-[11px] tabular text-fg outline-none"
      />
    </label>
  );
}
