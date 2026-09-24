/** Joins truthy class names. Tiny on purpose — no dependency needed. */
export function cx(...classes: (string | false | null | undefined)[]): string {
  return classes.filter(Boolean).join(' ');
}
