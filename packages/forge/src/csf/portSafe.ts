/**
 * Whether a MessagePort delivers `value` as the same thing it was. `structuredClone` succeeding is
 * not enough: it copies a class instance's fields onto a plain object and drops its methods.
 */
export function isPortSafe(value: unknown): boolean {
  const seen = new Set<object>();
  const safe = (v: unknown): boolean => {
    if (v === null) return true;
    if (typeof v !== 'object') return typeof v !== 'function' && typeof v !== 'symbol';
    if (seen.has(v)) return true;
    seen.add(v);
    if (v instanceof Date || v instanceof RegExp || v instanceof ArrayBuffer || ArrayBuffer.isView(v)) return true;
    if (v instanceof Map) return [...v].every(([key, member]) => safe(key) && safe(member));
    if (v instanceof Set) return [...v].every(safe);
    if (Array.isArray(v)) return v.every(safe);
    const proto = Object.getPrototypeOf(v);
    return (proto === Object.prototype || proto === null) && Object.values(v).every(safe);
  };
  return safe(value);
}
