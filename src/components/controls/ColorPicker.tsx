import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type PointerEvent, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { hexToRgb, hsvToRgb, isHexColor, rgbToHex, rgbToHsv, type Hsv } from '../../utils/color';
import { clamp } from '../../utils/viewMath';

interface ColorPickerProps {
  value: string;
  onChange(hex: string): void;
  label: string;
  /** Custom trigger; defaults to a round swatch. */
  children?: (props: { open: boolean }) => ReactNode;
}

const POPOVER_WIDTH = 232;

/**
 * HSV colour picker in a portal-mounted popover: saturation/value field,
 * hue strip and hex input. Keeps its own HSV state so hue survives when
 * saturation or value hits zero (hex alone would lose it).
 */
export function ColorPicker({ value, onChange, label, children }: ColorPickerProps) {
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState({ top: 0, left: 0 });
  const triggerRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    if (!open || !triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    const left = clamp(rect.left + rect.width / 2 - POPOVER_WIDTH / 2, 12, window.innerWidth - POPOVER_WIDTH - 12);
    const below = rect.bottom + 8;
    const top = below + 300 > window.innerHeight ? rect.top - 8 - 290 : below;
    setPosition({ top: Math.max(12, top), left });
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: globalThis.PointerEvent) => {
      const target = e.target as Node;
      if (!popoverRef.current?.contains(target) && !triggerRef.current?.contains(target)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    window.addEventListener('pointerdown', onDown);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('pointerdown', onDown);
      window.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <>
      <button
        ref={triggerRef}
        aria-label={label}
        aria-expanded={open}
        title={label}
        onClick={() => setOpen((o) => !o)}
        className="block rounded-full"
      >
        {children ? (
          children({ open })
        ) : (
          <span
            className="block size-6 rounded-full shadow-[inset_0_0_0_1px_rgb(255_255_255/0.18)]"
            style={{ background: value }}
          />
        )}
      </button>
      {open &&
        createPortal(
          <div
            ref={popoverRef}
            role="dialog"
            aria-label={label}
            className="glass animate-rise fixed z-50 rounded-[14px] p-3"
            style={{ top: position.top, left: position.left, width: POPOVER_WIDTH }}
          >
            <PickerBody value={value} onChange={onChange} />
          </div>,
          document.body,
        )}
    </>
  );
}

function PickerBody({ value, onChange }: { value: string; onChange(hex: string): void }) {
  const [hsv, setHsv] = useState<Hsv>(() => rgbToHsv(hexToRgb(value)));
  const [draft, setDraft] = useState(value);

  const commit = (next: Hsv) => {
    setHsv(next);
    const hex = rgbToHex(hsvToRgb(next));
    setDraft(hex);
    onChange(hex);
  };

  const hueColor = rgbToHex(hsvToRgb({ h: hsv.h, s: 1, v: 1 }));

  return (
    <div className="space-y-3">
      <DragArea
        className="relative h-36 rounded-[9px]"
        style={{ background: `linear-gradient(to top, #000, transparent), linear-gradient(to right, #fff, ${hueColor})` }}
        onDrag={(x, y) => commit({ ...hsv, s: x, v: 1 - y })}
        ariaLabel="Saturation and brightness"
      >
        <Handle x={hsv.s} y={1 - hsv.v} color={rgbToHex(hsvToRgb(hsv))} />
      </DragArea>
      <DragArea
        className="relative h-3 rounded-full"
        style={{
          background:
            'linear-gradient(to right, #f00 0%, #ff0 16.6%, #0f0 33.3%, #0ff 50%, #00f 66.6%, #f0f 83.3%, #f00 100%)',
        }}
        onDrag={(x) => commit({ ...hsv, h: Math.min(359.9, x * 360) })}
        ariaLabel="Hue"
      >
        <Handle x={hsv.h / 360} y={0.5} color={hueColor} />
      </DragArea>
      <div className="flex items-center gap-2">
        <span className="size-7 shrink-0 rounded-[7px] shadow-[inset_0_0_0_1px_rgb(255_255_255/0.15)]" style={{ background: value }} />
        <input
          value={draft}
          spellCheck={false}
          aria-label="Hex colour"
          onChange={(e) => {
            const next = e.target.value.startsWith('#') ? e.target.value : `#${e.target.value}`;
            setDraft(next);
            if (isHexColor(next)) {
              setHsv(rgbToHsv(hexToRgb(next)));
              onChange(next.toLowerCase());
            }
          }}
          className="h-7 w-full rounded-[7px] border border-line-strong bg-black/30 px-2 font-mono text-[11px] tabular text-fg uppercase outline-none focus:border-gilt/60"
        />
      </div>
    </div>
  );
}

function DragArea({
  className,
  style,
  onDrag,
  ariaLabel,
  children,
}: {
  className: string;
  style: CSSProperties;
  onDrag(x: number, y: number): void;
  ariaLabel: string;
  children: ReactNode;
}) {
  const update = (e: PointerEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    onDrag(clamp((e.clientX - rect.left) / rect.width, 0, 1), clamp((e.clientY - rect.top) / rect.height, 0, 1));
  };
  return (
    <div
      aria-label={ariaLabel}
      className={`${className} cursor-crosshair touch-none shadow-[inset_0_0_0_1px_rgb(255_255_255/0.08)]`}
      style={style}
      onPointerDown={(e) => {
        e.currentTarget.setPointerCapture(e.pointerId);
        update(e);
      }}
      onPointerMove={(e) => e.currentTarget.hasPointerCapture(e.pointerId) && update(e)}
    >
      {children}
    </div>
  );
}

function Handle({ x, y, color }: { x: number; y: number; color: string }) {
  return (
    <span
      className="pointer-events-none absolute size-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow-[0_1px_4px_rgb(0_0_0/0.5)]"
      style={{ left: `${x * 100}%`, top: `${y * 100}%`, background: color }}
    />
  );
}
