import { isPlainObject } from './isPlainObject';

/** Options for {@link deepEqual}. */
export interface DeepEqualOptions {
  /** Read a key holding `undefined` the same as one that is absent. Default `false`. */
  undefinedAsAbsent?: boolean;
}

/**
 * Structural equality over arrays and plain objects from any realm. Every other
 * value — a function, a class instance, a `Date`, a `Map` — equals only itself
 * (`Object.is`).
 */
export function deepEqual(a: unknown, b: unknown, opts: DeepEqualOptions = {}): boolean {
  if (Object.is(a, b)) return true;
  if (Array.isArray(a) || Array.isArray(b)) {
    if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) if (!deepEqual(a[i], b[i], opts)) return false;
    return true;
  }
  if (!isPlainObject(a) || !isPlainObject(b)) return false;
  if (opts.undefinedAsAbsent) {
    return [...new Set([...Object.keys(a), ...Object.keys(b)])].every((k) => deepEqual(own(a, k), own(b, k), opts));
  }
  const keys = Object.keys(a);
  return keys.length === Object.keys(b).length
    && keys.every((k) => Object.hasOwn(b, k) && deepEqual(a[k], b[k], opts));
}

/** `o`'s own `k`: a key named like an `Object.prototype` member is read as a plain own key. */
function own(o: Record<string, unknown>, k: string): unknown {
  return Object.hasOwn(o, k) ? o[k] : undefined;
}
