const SUPERSCRIPT: Record<string, string> = {
  '0': '⁰', '1': '¹', '2': '²', '3': '³', '4': '⁴', '5': '⁵', '6': '⁶', '7': '⁷', '8': '⁸', '9': '⁹',
  '.': '·', '-': '⁻',
};

/** Magnification as plain text, e.g. 2.7 → "×10²·⁷". */
export function formatMagnification(zoomLog: number): string {
  const exponent = String(Number(zoomLog.toFixed(1)));
  return `×10${[...exponent].map((ch) => SUPERSCRIPT[ch] ?? ch).join('')}`;
}

/** A complex number with typographic minus signs, e.g. "−0.8000 + 0.1560i". */
export function formatComplex(re: number, im: number, digits = 4): string {
  const real = `${re < 0 ? '−' : ''}${Math.abs(re).toFixed(digits)}`;
  return `${real} ${im < 0 ? '−' : '+'} ${Math.abs(im).toFixed(digits)}i`;
}
