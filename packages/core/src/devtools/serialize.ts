/**
 * Turn any value into plain data a panel can display. A node's `data` is the
 * app's own type, so nothing here assumes it is JSON-safe.
 *
 * A string, a finite number, a boolean, null and undefined arrive as themselves. Everything else that is not an
 * array or a plain object arrives as an object whose `$type` names it ({@link SerializedTag}). A plain object's own
 * keys that start with `$` arrive with one more `$` in front ({@link escapeKey}), so the only unescaped `$` keys
 * are the serializer's own: `$type`, `$class` (an instance's class) and `$more` (how many keys were cut).
 */

/** What {@link serialize} produces: JSON-safe apart from `undefined`, which structured clone carries. */
export type SerializedValue =
  | string | number | boolean | null | undefined
  | SerializedValue[]
  | { [key: string]: SerializedValue };

/** A value {@link serialize} writes as an object tagged with what it was. */
export type SerializedTag =
  | { $type: 'number'; value: 'NaN' | 'Infinity' | '-Infinity' }
  | { $type: 'bigint'; value: string }
  | { $type: 'symbol'; value: string }
  | { $type: 'function'; name: string }
  /** A reference to an object that contains it. */
  | { $type: 'cycle' }
  /** A getter that threw, with what it threw. */
  | { $type: 'threw'; value: string }
  /** Nesting past the depth limit. */
  | { $type: 'depth' }
  /** The entries of an array, map or set past the item limit. */
  | { $type: 'more'; count: number }
  | { $type: 'Date'; value: string }
  | { $type: 'Map' | 'Set'; size: number; entries: SerializedValue[] }
  /** A typed array, by its constructor's name. */
  | { $type: string; length: number };

/** How much of a value {@link serialize} writes out. */
export interface SerializeLimits {
  /** Nesting below this depth is written as a `depth` tag. */
  depth?: number;
  /** Array, map, set and object entries past this many are cut, with a note of how many. */
  items?: number;
  /** Strings longer than this are cut, ending in `…`. */
  chars?: number;
}

/** A plain object's own key as {@link serialize} writes it: one more `$` in front of a key that starts with `$`. */
export const escapeKey = (key: string): string => (key.startsWith('$') ? `$${key}` : key);

/** The object key {@link escapeKey} wrote `key` from, or null for one of the serializer's own keys. */
export function unescapeKey(key: string): string | null {
  if (key.startsWith('$$')) return key.slice(1);
  return key.startsWith('$') ? null : key;
}

/** A serialized number as a number: itself, or the non-finite number a `number` tag names; NaN for anything else. */
export function serializedNumber(value: SerializedValue): number {
  if (typeof value === 'number') return value;
  const tag = typeof value === 'object' && value !== null && !Array.isArray(value) ? value : null;
  return tag?.$type === 'number' && typeof tag.value === 'string' ? Number(tag.value) : Number.NaN;
}

const TYPED = [
  Int8Array, Uint8Array, Uint8ClampedArray, Int16Array, Uint16Array,
  Int32Array, Uint32Array, Float32Array, Float64Array, BigInt64Array, BigUint64Array,
];

/** What a getter threw, as the value it stands for: an app's `data` may compute a field that is not ready yet. */
class Threw {
  constructor(readonly error: unknown) {}
}

function read(obj: object, key: string): unknown {
  try {
    return (obj as Record<string, unknown>)[key];
  } catch (error) {
    return new Threw(error);
  }
}

function describeThrown(error: unknown): string {
  try {
    return String(error);
  } catch {
    return 'unprintable';
  }
}

const tagOf = (value: object): string => Object.prototype.toString.call(value).slice(8, -1);

function isTyped(value: object): value is ArrayBufferView {
  return ArrayBuffer.isView(value) && !(value instanceof DataView)
    && TYPED.some((T) => tagOf(value) === T.name);
}

const tagged = (tag: SerializedTag): SerializedValue => tag as SerializedValue;

/** `value` as plain data: anything JSON cannot say tagged, cycles marked, and every size capped. */
export function serialize(value: unknown, limits: SerializeLimits = {}): SerializedValue {
  const depth = limits.depth ?? 6;
  const items = limits.items ?? 100;
  const chars = limits.chars ?? 1000;
  const open = new Set<object>();

  const more = (count: number): SerializedValue => tagged({ $type: 'more', count: count - items });

  const walk = (v: unknown, level: number): SerializedValue => {
    switch (typeof v) {
      case 'string': return v.length > chars ? `${v.slice(0, chars)}…` : v;
      case 'number':
        return Number.isFinite(v) ? v : tagged({ $type: 'number', value: String(v) as 'NaN' | 'Infinity' | '-Infinity' });
      case 'boolean': return v;
      case 'undefined': return undefined;
      case 'bigint': return tagged({ $type: 'bigint', value: v.toString() });
      case 'symbol': return tagged({ $type: 'symbol', value: v.toString() });
      case 'function': return tagged({ $type: 'function', name: v.name || 'anonymous' });
    }
    if (v === null) return null;
    if (v instanceof Threw) return tagged({ $type: 'threw', value: describeThrown(v.error) });
    const obj = v as object;
    if (open.has(obj)) return tagged({ $type: 'cycle' });
    if (level >= depth) return tagged({ $type: 'depth' });
    if (isTyped(obj)) return tagged({ $type: tagOf(obj), length: (obj as unknown as { length: number }).length });
    if (obj instanceof Date || tagOf(obj) === 'Date') {
      const time = (obj as Date).getTime();
      return tagged({ $type: 'Date', value: Number.isNaN(time) ? 'Invalid Date' : (obj as Date).toISOString() });
    }
    open.add(obj);
    try {
      if (Array.isArray(obj)) {
        const out = obj.slice(0, items).map((x) => walk(x, level + 1));
        if (obj.length > items) out.push(more(obj.length));
        return out;
      }
      const tag = tagOf(obj);
      if (tag === 'Map' || tag === 'Set') {
        const all = tag === 'Map' ? [...(obj as Map<unknown, unknown>)] : [...(obj as Set<unknown>)];
        const entries = all.slice(0, items).map((x) => walk(x, level + 1));
        if (all.length > items) entries.push(more(all.length));
        return tagged({ $type: tag, size: all.length, entries });
      }
      const out: { [key: string]: SerializedValue } = {};
      const proto = Object.getPrototypeOf(obj) as object | null;
      if (proto !== null && proto !== Object.prototype && tag === 'Object') {
        const name = (proto.constructor as { name?: string } | undefined)?.name;
        if (name && name !== 'Object') out.$class = name;
      }
      const keys = Object.keys(obj);
      for (const key of keys.slice(0, items)) out[escapeKey(key)] = walk(read(obj, key), level + 1);
      if (keys.length > items) out.$more = keys.length - items;
      return out;
    } finally {
      open.delete(obj);
    }
  };

  return walk(value, 0);
}
