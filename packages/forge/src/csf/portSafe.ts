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

const isPlainOrNull = (v: unknown): v is Record<string, unknown> => {
  if (!v || typeof v !== 'object') return false;
  const proto = Object.getPrototypeOf(v);
  return proto === Object.prototype || proto === null;
};

/** A plain object or array whose members can be split: React elements are plain objects, but whole. */
const splittable = (v: unknown): v is Record<string, unknown> | unknown[] =>
  (Array.isArray(v) ? Object.getPrototypeOf(v) === Array.prototype : isPlainOrNull(v) && !('$$typeof' in v)) &&
  hasOnlyClonedKeys(v as object);

/**
 * The part of `value` a port delivers intact, or null when none of it can cross. A plain object
 * keeps its port-safe fields; an array holds null where a member has no part.
 */
export function portSafePart(value: unknown): { value: unknown } | null {
  const walking = new Set<object>();
  const part = (v: unknown): { value: unknown } | null => {
    if (isPortSafe(v)) return { value: v };
    if (!splittable(v) || walking.has(v)) return null;
    walking.add(v);
    try {
      if (Array.isArray(v)) return { value: v.map((member) => part(member)?.value ?? null) };
      const out: Record<string, unknown> = {};
      for (const [key, member] of Object.entries(v)) {
        const kept = part(member);
        if (kept) out[key] = kept.value;
      }
      return { value: out };
    } finally {
      walking.delete(v);
    }
  };
  try {
    return part(value);
  } catch {
    return null;
  }
}

/** `sent`, a value that crossed the port as `portSafePart(original)` or an edit of it, with what the part left behind put back. */
export function withUnsent(sent: unknown, original: unknown): unknown {
  if (isPortSafe(original)) return sent;
  if (sent === null && portSafePart(original) === null) return original;
  if (Array.isArray(original) && Array.isArray(sent))
    return sent.map((member, i) => (i < original.length ? withUnsent(member, original[i]) : member));
  if (!splittable(original) || Array.isArray(original) || !isPlainOrNull(sent)) return sent;
  const out: Record<string, unknown> = {};
  for (const [key, member] of Object.entries(original)) {
    if (key in sent) out[key] = withUnsent(sent[key], member);
    else if (portSafePart(member) === null) out[key] = member;
  }
  for (const [key, member] of Object.entries(sent)) if (!(key in original)) out[key] = member;
  return out;
}
