import type { CSSProperties } from 'react';
import { clamp01 } from './timeline';

/** Design margin of the frame, in px. */
export const MARGIN = 96;

/** Opacity and a short vertical travel for a block entering (`shown`) and leaving (`gone`). */
export function drift(shown: number, gone = 0, distance = 22): CSSProperties {
  return {
    opacity: clamp01(shown) * (1 - clamp01(gone)),
    transform: `translateY(${(1 - shown) * distance - gone * distance}px)`,
  };
}

export const formatCount = (n: number) => n.toLocaleString('en-US');

/** "1.2M" above a million, otherwise grouped digits. */
export const formatShort = (n: number) => (n >= 1e6 ? `${(n / 1e6).toFixed(1)}M` : formatCount(n));
