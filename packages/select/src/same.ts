/** Whether `a` and `b` are one id as a `Set` and `includes` read them: `NaN` is itself, `-0` is `0`. */
export function sameId(a: unknown, b: unknown): boolean {
  return a === b || (Number.isNaN(a) && Number.isNaN(b));
}
