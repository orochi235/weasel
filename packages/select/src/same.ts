/** Whether `a` and `b` are one id as a `Set` and `includes` read them: `NaN` is itself, `-0` is `0`. */
export function sameId(a: unknown, b: unknown): boolean {
  return a === b || (Number.isNaN(a) && Number.isNaN(b));
}

/** A new array of `ids` with each id once, at its first place. */
export function once<K>(ids: readonly K[]): K[] {
  const seen = new Set<K>();
  return ids.filter((id) => !seen.has(id) && Boolean(seen.add(id)));
}
