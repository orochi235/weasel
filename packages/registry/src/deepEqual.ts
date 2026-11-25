import { isPlainObject } from './isPlainObject';

/** Options for {@link deepEqual}. */
export interface DeepEqualOptions {
  /** Read a key holding `undefined` the same as one that is absent. Default `false`. */
  undefinedAsAbsent?: boolean;
}

/**
 * Structural equality over arrays and plain objects from any realm, comparing each own enumerable
 * key, symbols included. Every other
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
    return [...new Set([...keysOf(a), ...keysOf(b)])].every((k) => deepEqual(own(a, k), own(b, k), opts));
  }
  const keys = keysOf(a);
  return keys.length === keysOf(b).length
    && keys.every((k) => isOwnEnumerable(b, k) && deepEqual(own(a, k), own(b, k), opts));
}

type Key = string | symbol;

/** `o`'s own enumerable keys, its symbols included. */
function keysOf(o: object): Key[] {
  return [...Object.keys(o), ...Object.getOwnPropertySymbols(o).filter((k) => isOwnEnumerable(o, k))];
}

function isOwnEnumerable(o: object, k: Key): boolean {
  return Object.prototype.propertyIsEnumerable.call(o, k);
}

/** `o`'s own `k`: a key named like an `Object.prototype` member is read as a plain own key. */
function own(o: Record<Key, unknown>, k: Key): unknown {
  return Object.hasOwn(o, k) && isOwnEnumerable(o, k) ? o[k] : undefined;
}
