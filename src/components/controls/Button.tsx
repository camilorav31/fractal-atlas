import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { cx } from './cx';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost';
  icon?: ReactNode;
  /** Keyboard shortcut hint rendered as a key cap. */
  shortcut?: string;
}

export function Button({ variant = 'secondary', icon, shortcut, className, children, ...rest }: ButtonProps) {
  return (
    <button
      {...rest}
      className={cx(
        'inline-flex h-9 items-center justify-center gap-2 rounded-[10px] px-3.5 text-[12px] font-medium',
        'transition-all duration-200 ease-soft active:scale-[0.98] disabled:pointer-events-none disabled:opacity-40',
        variant === 'primary' &&
          'bg-fg text-void shadow-[inset_0_-1px_0_rgb(0_0_0/0.15),0_1px_12px_rgb(236_235_230/0.12)] hover:bg-white',
        variant === 'secondary' && 'border border-line-strong bg-white/[0.04] text-fg hover:bg-white/[0.08]',
        variant === 'ghost' && 'text-fg-muted hover:bg-white/[0.05] hover:text-fg',
        className,
      )}
    >
      {icon}
      {children}
      {shortcut && <Kbd tone={variant === 'primary' ? 'dark' : 'light'}>{shortcut}</Kbd>}
    </button>
  );
}

export function Kbd({ children, tone = 'light' }: { children: ReactNode; tone?: 'light' | 'dark' }) {
  return (
    <kbd
      className={cx(
        'ml-0.5 inline-flex h-[18px] [@media(hover:none)]:hidden min-w-[18px] items-center justify-center rounded-[5px] px-1 font-mono text-[10px] font-normal',
        tone === 'light' ? 'border border-line-strong text-fg-subtle' : 'bg-black/10 text-void/60',
      )}
    >
      {children}
    </kbd>
  );
}

interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  label: string;
  children: ReactNode;
}

export function IconButton({ label, children, className, ...rest }: IconButtonProps) {
  return (
    <button
      {...rest}
      aria-label={label}
      title={label}
      className={cx(
        'inline-flex size-8 items-center justify-center rounded-[9px] text-fg-muted',
        'transition-colors duration-200 hover:bg-white/[0.06] hover:text-fg',
        className,
      )}
    >
      {children}
    </button>
  );
}
