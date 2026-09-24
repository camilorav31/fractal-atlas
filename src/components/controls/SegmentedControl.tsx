import { cx } from './cx';

export interface SegmentOption<T extends string> {
  value: T;
  label: string;
  disabled?: boolean;
  /** Small caption shown under disabled options, e.g. "Soon". */
  note?: string;
}

interface SegmentedControlProps<T extends string> {
  options: readonly SegmentOption<T>[];
  value: T;
  onChange(value: T): void;
  label: string;
  size?: 'sm' | 'md';
}

/** Equal-width segments with a sliding indicator. */
export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  label,
  size = 'md',
}: SegmentedControlProps<T>) {
  const index = Math.max(0, options.findIndex((o) => o.value === value));
  return (
    <div
      role="radiogroup"
      aria-label={label}
      className="relative grid rounded-[10px] border border-line bg-black/25 p-[3px]"
      style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}
    >
      <div
        aria-hidden
        className="absolute top-[3px] bottom-[3px] left-[3px] rounded-[7px] border border-line-strong bg-glass-raised shadow-[inset_0_1px_0_rgb(255_255_255/0.06)] transition-transform duration-400 ease-out-expo"
        style={{
          width: `calc((100% - 6px) / ${options.length})`,
          transform: `translateX(${index * 100}%)`,
        }}
      />
      {options.map((option) => {
        const active = option.value === value;
        return (
          <button
            key={option.value}
            role="radio"
            aria-checked={active}
            disabled={option.disabled}
            title={option.disabled ? `${option.label} — coming soon` : option.label}
            onClick={() => onChange(option.value)}
            className={cx(
              'relative z-10 flex flex-col items-center justify-center rounded-[7px] transition-colors duration-200',
              size === 'sm' ? 'h-7 text-[11px]' : 'h-9 text-[12px]',
              active ? 'text-fg' : 'text-fg-muted hover:text-fg',
              option.disabled && 'cursor-not-allowed text-fg-subtle/70 hover:text-fg-subtle/70',
            )}
          >
            <span className="leading-none">{option.label}</span>
            {option.note && (
              <span className="mt-1 text-[8.5px] leading-none tracking-[0.16em] uppercase opacity-70">
                {option.note}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
