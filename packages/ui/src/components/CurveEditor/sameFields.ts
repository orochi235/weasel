/**
 * Whether two layer states hold the same values field by field. A layer
 * returns a fresh object from every gesture callback, so identity alone
 * cannot tell a gesture that changed nothing from one that did.
 */
export function sameFields(a: unknown, b: unknown): boolean {
  if (Object.is(a, b)) return true;
  if (typeof a !== 'object' || typeof b !== 'object' || a === null || b === null) return false;
  const ka = Object.keys(a);
  if (ka.length !== Object.keys(b).length) return false;
  const ra = a as Record<string, unknown>;
  const rb = b as Record<string, unknown>;
  return ka.every((k) => k in rb && Object.is(ra[k], rb[k]));
}
