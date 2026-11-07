/**
 * Turn any value into plain data a panel can display. A node's `data` is the
 * app's own type, so nothing here assumes it is JSON-safe.
 */

/** What {@link serialize} produces: JSON-safe apart from `undefined`, which structured clone carries. */
export type SerializedValue =
  | string | number | boolean | null | undefined
  | SerializedValue[]
  | { [key: string]: SerializedValue };

/** How much of a value {@link serialize} writes out. */
export interface SerializeLimits {
  /** Nesting below this depth is written as `'…'`. */
  depth?: number;
  /** Array, map, set and object entries past this many are cut, with a note of how many. */
  items?: number;
  /** Strings longer than this are cut. */
  chars?: number;
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

/** `value` as plain data: functions as `ƒ name`, typed arrays as their type and
 *  length, maps and sets tagged, cycles marked, and every size capped. */
export function serialize(value: unknown, limits: SerializeLimits = {}): SerializedValue {
  const depth = limits.depth ?? 6;
  const items = limits.items ?? 100;
  const chars = limits.chars ?? 1000;
  const open = new Set<object>();

  const cut = (count: number): string => `… ${count - items} more`;

  const walk = (v: unknown, level: number): SerializedValue => {
    switch (typeof v) {
      case 'string': return v.length > chars ? `${v.slice(0, chars)}…` : v;
      case 'number': return Number.isFinite(v) ? v : String(v);
      case 'boolean': return v;
      case 'undefined': return undefined;
      case 'bigint': return `${v}n`;
      case 'symbol': return v.toString();
      case 'function': return `ƒ ${v.name || 'anonymous'}`;
    }
    if (v === null) return null;
    if (v instanceof Threw) return `[threw: ${describeThrown(v.error)}]`;
    const obj = v as object;
    if (open.has(obj)) return '[cycle]';
    if (level >= depth) return '…';
    if (isTyped(obj)) return { $type: tagOf(obj), length: (obj as unknown as { length: number }).length };
    if (obj instanceof Date || tagOf(obj) === 'Date') {
      const time = (obj as Date).getTime();
      return { $type: 'Date', value: Number.isNaN(time) ? 'Invalid Date' : (obj as Date).toISOString() };
    }
    open.add(obj);
    try {
      if (Array.isArray(obj)) {
        const out = obj.slice(0, items).map((x) => walk(x, level + 1));
        if (obj.length > items) out.push(cut(obj.length));
        return out;
      }
      const tag = tagOf(obj);
      if (tag === 'Map' || tag === 'Set') {
        const all = tag === 'Map' ? [...(obj as Map<unknown, unknown>)] : [...(obj as Set<unknown>)];
        const entries = all.slice(0, items).map((x) => walk(x, level + 1));
        if (all.length > items) entries.push(cut(all.length));
        return { $type: tag, size: all.length, entries };
      }
      const out: { [key: string]: SerializedValue } = {};
      const proto = Object.getPrototypeOf(obj) as object | null;
      if (proto !== null && proto !== Object.prototype && tag === 'Object') {
        const name = (proto.constructor as { name?: string } | undefined)?.name;
        if (name && name !== 'Object') out.$class = name;
      }
      const keys = Object.keys(obj);
      for (const key of keys.slice(0, items)) out[key] = walk(read(obj, key), level + 1);
      if (keys.length > items) out['…'] = cut(keys.length);
      return out;
    } finally {
      open.delete(obj);
    }
  };

  return walk(value, 0);
}
