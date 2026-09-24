import { Plus, X } from 'lucide-react';
import type { PaletteId } from '../../fractals/types';
import { cssGradient } from '../../utils/color';
import { PALETTES } from '../../utils/palettes';
import { ColorPicker } from './ColorPicker';
import { cx } from './cx';

interface PalettePickerProps {
  value: PaletteId | 'custom';
  customStops: string[];
  onChange(value: PaletteId | 'custom'): void;
  onCustomStopsChange(stops: string[]): void;
}

const MIN_STOPS = 2;
const MAX_STOPS = 6;

export function PalettePicker({ value, customStops, onChange, onCustomStopsChange }: PalettePickerProps) {
  return (
    <div>
      <div role="radiogroup" aria-label="Palette" className="grid grid-cols-3 gap-x-2 gap-y-3">
        {PALETTES.map((palette) => (
          <Swatch
            key={palette.id}
            name={palette.name}
            gradient={cssGradient(palette.stops)}
            active={value === palette.id}
            onSelect={() => onChange(palette.id)}
          />
        ))}
      </div>

      <div className="mt-4">
        <Swatch
          name="Custom"
          gradient={cssGradient(customStops)}
          active={value === 'custom'}
          onSelect={() => onChange('custom')}
          wide
        />
        {value === 'custom' && (
          <div className="animate-rise mt-3 flex items-center gap-2">
            {customStops.map((stop, index) => (
              <div key={index} className="group relative">
                <ColorPicker
                  value={stop}
                  label={`Stop ${index + 1}`}
                  onChange={(hex) => onCustomStopsChange(customStops.map((s, i) => (i === index ? hex : s)))}
                />
                {customStops.length > MIN_STOPS && (
                  <button
                    aria-label={`Remove stop ${index + 1}`}
                    onClick={() => onCustomStopsChange(customStops.filter((_, i) => i !== index))}
                    className="absolute -top-1.5 -right-1.5 hidden size-3.5 items-center justify-center rounded-full bg-fg text-void group-hover:flex"
                  >
                    <X size={9} strokeWidth={3} />
                  </button>
                )}
              </div>
            ))}
            {customStops.length < MAX_STOPS && (
              <button
                aria-label="Add colour stop"
                onClick={() => onCustomStopsChange([...customStops, customStops.at(-1) ?? '#ffffff'])}
                className="flex size-6 items-center justify-center rounded-full border border-dashed border-line-strong text-fg-subtle transition-colors hover:border-fg-muted hover:text-fg"
              >
                <Plus size={12} />
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function Swatch({
  name,
  gradient,
  active,
  onSelect,
  wide = false,
}: {
  name: string;
  gradient: string;
  active: boolean;
  onSelect(): void;
  wide?: boolean;
}) {
  return (
    <button role="radio" aria-checked={active} onClick={onSelect} className="group block w-full text-left">
      <span
        className={cx(
          'block rounded-[7px] transition-all duration-300 ease-soft',
          wide ? 'h-5' : 'h-7',
          active
            ? 'shadow-[0_0_0_1px_var(--color-void),0_0_0_2px_var(--color-gilt)]'
            : 'shadow-[inset_0_0_0_1px_rgb(255_255_255/0.08)] group-hover:shadow-[0_0_0_1px_var(--color-void),0_0_0_2px_rgb(255_255_255/0.25)]',
        )}
        style={{ background: gradient }}
      />
      <span
        className={cx(
          'mt-1.5 block text-[11px] transition-colors',
          active ? 'text-fg' : 'text-fg-subtle group-hover:text-fg-muted',
        )}
      >
        {name}
      </span>
    </button>
  );
}
