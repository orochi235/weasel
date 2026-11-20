import { isPlainObject } from '@weasel-js/registry';

/** Whether `b` is what a structured clone of `a` could read back as: arrays and plain objects by their keys, a `Map`
 *  or `Set` by its entries in order, a `Date` by its time, a buffer or typed array by its bytes, a `RegExp` by its
 *  source and flags. Anything else equals only itself. */
export function cloneEqual(a: unknown, b: unknown): boolean {
  if (Object.is(a, b)) return true;
  if (typeof a !== 'object' || typeof b !== 'object' || a === null || b === null) return false;
  // By tag, not prototype: a clone may come back from another realm.
  const tag = Object.prototype.toString.call(a);
  if (tag !== Object.prototype.toString.call(b)) return false;
  if (Array.isArray(a)) return Array.isArray(b) && listEqual(a, b);
  switch (tag) {
    case '[object Date]':
      return Object.is((a as Date).getTime(), (b as Date).getTime());
    case '[object RegExp]':
      return String(a) === String(b);
    case '[object Map]':
      return listEqual([...(a as Map<unknown, unknown>)], [...(b as Map<unknown, unknown>)]);
    case '[object Set]':
      return listEqual([...(a as Set<unknown>)], [...(b as Set<unknown>)]);
    case '[object ArrayBuffer]':
      return bytesEqual(new Uint8Array(a as ArrayBuffer), new Uint8Array(b as ArrayBuffer));
  }
  if (ArrayBuffer.isView(a) && ArrayBuffer.isView(b)) {
    return bytesEqual(
      new Uint8Array(a.buffer, a.byteOffset, a.byteLength),
      new Uint8Array(b.buffer, b.byteOffset, b.byteLength),
    );
  }
  if (!isPlainObject(a) || !isPlainObject(b)) return false;
  const keys = Object.keys(a);
  return keys.length === Object.keys(b).length && keys.every((k) => Object.hasOwn(b, k) && cloneEqual(a[k], b[k]));
}

function listEqual(a: unknown[], b: unknown[]): boolean {
  return a.length === b.length && a.every((v, i) => cloneEqual(v, b[i]));
}

function bytesEqual(a: Uint8Array, b: Uint8Array): boolean {
  return a.length === b.length && a.every((v, i) => v === b[i]);
}
