/**
 * Whether `a` and `b` hold equal elements in the same order: the same length,
 * and `same` true at every index. `same` defaults to `===`. Order counts; for
 * two lists holding the same members in any order, compare them as sets.
 */
export function sameList<T>(
  a: readonly T[],
  b: readonly T[],
  same: (x: T, y: T) => boolean = (x, y) => x === y,
): boolean {
  if (a === b) return true;
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (!same(a[i]!, b[i]!)) return false;
  return true;
}
