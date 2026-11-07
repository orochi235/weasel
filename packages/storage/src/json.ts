/** Raw strings written before records existed come back as the string they
 *  are. */
export function parse(raw: string): unknown {
  try {
    return JSON.parse(raw);
  } catch {
    return raw;
  }
}

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
 *  key yields the same `undefined`. */
export function isJsonSafe(value: unknown, seen: Set<object> = new Set()): boolean {
  if (value === null) return true;
  switch (typeof value) {
    case 'string':
    case 'boolean':
      return true;
    case 'number':
      return Number.isFinite(value);
    case 'object': {
      if (seen.has(value)) return false;
      seen.add(value);
      const proto = Object.getPrototypeOf(value);
      const ok = Array.isArray(value)
        ? value.every((v) => isJsonSafe(v, seen))
        : (proto === Object.prototype || proto === null) &&
          Object.values(value).every((v) => v === undefined || isJsonSafe(v, seen));
      seen.delete(value);
      return ok;
    }
    default:
      return false;
  }
}
