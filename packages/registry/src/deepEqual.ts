import { isPlainObject } from './isPlainObject';

/** Options for {@link deepEqual}. */
export interface DeepEqualOptions {
  /** Read a key holding `undefined` the same as one that is absent. Default `false`. */
  undefinedAsAbsent?: boolean;
}

/**
 * Structural equality over plain arrays and plain objects from any realm, comparing each own enumerable
 * key, symbols included. Every other
 * value — a function, a class instance (an `Array` subclass's included), a `Date`, a `Map` — equals only itself
 * (`Object.is`). Values that hold themselves compare by shape: two cycles that unfold alike are equal.
 */
export function deepEqual(a: unknown, b: unknown, opts: DeepEqualOptions = {}): boolean {
  return equal(a, b, opts, new Map());
}

/** `pairs` holds each pair of containers already under comparison, so a cycle reads as equal on its way round. */
function equal(a: unknown, b: unknown, opts: DeepEqualOptions, pairs: Map<object, Set<object>>): boolean {
  if (Object.is(a, b)) return true;
  if (isPlainArray(a) || isPlainArray(b)) {
    if (!isPlainArray(a) || !isPlainArray(b) || a.length !== b.length) return false;
    if (!enter(pairs, a, b)) return true;
    for (let i = 0; i < a.length; i++) if (!equal(a[i], b[i], opts, pairs)) return false;
    return sameKeys(a, b, extraKeysOf, opts, pairs);
  }
  if (!isPlainObject(a) || !isPlainObject(b)) return false;
  if (!enter(pairs, a, b)) return true;
  return sameKeys(a, b, keysOf, opts, pairs);
}

/** Whether `a` and `b` hold equal values under every key `keys` reads from either. */
function sameKeys(
  a: object, b: object, keys: (o: object) => Key[], opts: DeepEqualOptions, pairs: Map<object, Set<object>>,
): boolean {
  const ka = keys(a);
  if (opts.undefinedAsAbsent) {
    return [...new Set([...ka, ...keys(b)])].every((k) => equal(own(a, k), own(b, k), opts, pairs));
  }
  return ka.length === keys(b).length && ka.every((k) => isOwnEnumerable(b, k) && equal(own(a, k), own(b, k), opts, pairs));
}

/** An array whose prototype is some realm's `Array.prototype`, itself an array, rather than a subclass's. */
function isPlainArray(v: unknown): v is unknown[] {
  return Array.isArray(v) && Array.isArray(Object.getPrototypeOf(v));
}

/** Record that `a` and `b` are being compared; false when they already were. */
function enter(pairs: Map<object, Set<object>>, a: object, b: object): boolean {
  const seen = pairs.get(a) ?? new Set<object>();
  if (seen.has(b)) return false;
  pairs.set(a, seen.add(b));
  return true;
}

type Key = string | symbol;

/** `o`'s own enumerable keys, its symbols included. */
function keysOf(o: object): Key[] {
  return [...Object.keys(o), ...Object.getOwnPropertySymbols(o).filter((k) => isOwnEnumerable(o, k))];
}

/** An array's own enumerable keys other than its indices. */
function extraKeysOf(o: object): Key[] {
  return keysOf(o).filter((k) => typeof k === 'symbol' || !isIndex(k));
}

function isIndex(k: string): boolean {
  const n = Number(k);
  return Number.isInteger(n) && n >= 0 && n < 2 ** 32 - 1 && String(n) === k;
}

function isOwnEnumerable(o: object, k: Key): boolean {
  return Object.prototype.propertyIsEnumerable.call(o, k);
}

/** `o`'s own `k`: a key named like an `Object.prototype` member is read as a plain own key. */
function own(o: object, k: Key): unknown {
  return Object.hasOwn(o, k) && isOwnEnumerable(o, k) ? (o as Record<Key, unknown>)[k] : undefined;
}
