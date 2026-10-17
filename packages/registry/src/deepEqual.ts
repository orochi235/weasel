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
    return Array.isArray(a) && Array.isArray(b) && a.length === b.length
      && a.every((v, i) => deepEqual(v, b[i], opts));
  }
  if (!isPlainObject(a) || !isPlainObject(b)) return false;
  if (opts.undefinedAsAbsent) {
    return [...new Set([...Object.keys(a), ...Object.keys(b)])].every((k) => deepEqual(a[k], b[k], opts));
  }
  const keys = Object.keys(a);
  return keys.length === Object.keys(b).length
    && keys.every((k) => Object.hasOwn(b, k) && deepEqual(a[k], b[k], opts));
}
