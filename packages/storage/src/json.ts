import { isPlainObject } from '@weasel-js/registry';

/** Raw strings written before records existed come back as the string they
 *  are. */
export function parse(raw: string): unknown {
  try {
    return JSON.parse(raw);
  } catch {
    return raw;
  }
}

/** `value` as JSON text, for an adapter that stores JSON. A `bigint`, which `JSON.stringify` throws on, is written as
 *  its decimal digits, and a value JSON has no text for as `null`; {@link jsonLossWarner} warns about it as about anything else JSON changes. */
export function toJson(value: unknown): string {
  return JSON.stringify(value, (_, v: unknown) => (typeof v === 'bigint' ? v.toString() : v)) ?? 'null';
}

/** Whether a store keeping what JSON keeps holds `a` and `b` alike: the same JSON text, keys in the order written, a
 *  `bigint` as {@link toJson} writes it. A value JSON cannot write, such as one holding a cycle, is alike only to
 *  itself. Key order counts: a read back from storage keeps the order it was written in. */
export function sameStored(a: unknown, b: unknown): boolean {
  if (Object.is(a, b)) return true;
  try {
    const text = JSON.stringify(a, bigintAsDigits);
    return text !== undefined && text === JSON.stringify(b, bigintAsDigits);
  } catch {
    return false;
  }
}

const bigintAsDigits = (_: string, v: unknown): unknown => (typeof v === 'bigint' ? v.toString() : v);

/** A check for an adapter that stores JSON: warns once per key about a value JSON would change. */
export function jsonLossWarner(substrate: string): (key: string, value: unknown) => void {
  const warned = new Set<string>();
  return (key, value) => {
    if (warned.has(key) || isJsonSafe(value)) return;
    warned.add(key);
    console.warn(
      `[storage] "${key}" holds a value JSON cannot keep exactly; ${substrate} stores what JSON keeps. Use IndexedDB for binary or non-JSON state.`,
    );
  };
}

/** Whether `JSON.stringify` would keep `value` exactly. An object key holding
 *  `undefined` counts as kept: JSON drops the key, and reading back an absent
 *  key yields the same `undefined`. JSON writes `-0` as `0` and an array's hole as `null`. */
export function isJsonSafe(value: unknown, seen: Set<object> = new Set()): boolean {
  if (value === null) return true;
  switch (typeof value) {
    case 'string':
    case 'boolean':
      return true;
    case 'number':
      return Number.isFinite(value) && !Object.is(value, -0);
    case 'object': {
      if (seen.has(value)) return false;
      seen.add(value);
      const ok = Array.isArray(value)
        ? isDenseList(value) && value.every((v) => isJsonSafe(v, seen))
        : isPlainObject(value) && Object.values(value).every((v) => v === undefined || isJsonSafe(v, seen));
      seen.delete(value);
      return ok;
    }
    default:
      return false;
  }
}

/** Every index of `list` held, and no other key beside them. */
function isDenseList(list: unknown[]): boolean {
  const keys = Object.keys(list);
  return keys.length === list.length && keys.every((k, i) => k === String(i));
}
