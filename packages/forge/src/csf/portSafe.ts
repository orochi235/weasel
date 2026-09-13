const g = globalThis as Record<string, unknown>;
const CLONED_WHOLE = new Set<unknown>(
  [
    'Date',
    'RegExp',
    'ArrayBuffer',
    'DataView',
    'Int8Array',
    'Uint8Array',
    'Uint8ClampedArray',
    'Int16Array',
    'Uint16Array',
    'Int32Array',
    'Uint32Array',
    'Float16Array',
    'Float32Array',
    'Float64Array',
    'BigInt64Array',
    'BigUint64Array',
  ]
    .map((name) => (g[name] as { prototype?: object } | undefined)?.prototype)
    .filter(Boolean),
);

/** Own keys a clone keeps: enumerable string keys, plus an array's `length`. */
const hasOnlyClonedKeys = (v: object): boolean =>
  Reflect.ownKeys(v).every(
    (key) =>
      typeof key === 'string' &&
      (Object.prototype.propertyIsEnumerable.call(v, key) || (Array.isArray(v) && key === 'length')),
  );

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
    const proto = Object.getPrototypeOf(v);
    if (CLONED_WHOLE.has(proto)) return true;
    if (proto === Map.prototype)
      return hasOnlyClonedKeys(v) && [...(v as Map<unknown, unknown>)].every(([key, member]) => safe(key) && safe(member));
    if (proto === Set.prototype) return hasOnlyClonedKeys(v) && [...(v as Set<unknown>)].every(safe);
    if (proto !== Array.prototype && proto !== Object.prototype && proto !== null) return false;
    return hasOnlyClonedKeys(v) && Object.values(v).every(safe);
  };
  try {
    return safe(value);
  } catch {
    return false;
  }
}
