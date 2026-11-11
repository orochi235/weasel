/**
 * JSON with object keys sorted, so two equal values produce one string. What JSON cannot write and would throw on
 * is written with the tags devtools serialization uses: a bigint as `{"$type":"bigint","value":"10"}`, a reference
 * to an object that contains it as `{"$type":"cycle"}`.
 */
export function stableStringify(value: unknown): string {
  const open = new Set<object>();
  // As `JSON.stringify` reads a member: its `toJSON` once, called with its key, and a boxed primitive unwrapped.
  const sorted = (v: unknown, key: string): unknown => {
    if (v !== null && (typeof v === 'object' || typeof v === 'bigint')) {
      const json = (v as { toJSON?: unknown }).toJSON;
      if (typeof json === 'function') v = (json as (key: string) => unknown).call(v, key);
    }
    if (v instanceof Number || v instanceof String || v instanceof Boolean || v instanceof BigInt) v = v.valueOf();
    if (typeof v === 'bigint') return { $type: 'bigint', value: v.toString() };
    if (v === null || typeof v !== 'object') return v;
    if (open.has(v)) return { $type: 'cycle' };
    open.add(v);
    try {
      if (Array.isArray(v)) return v.map((member, i) => sorted(member, String(i)));
      // Members JSON leaves out are left out here, so none (a `toJSON` among them) reaches the final write.
      return Object.fromEntries(
        Object.entries(v).sort(([a], [b]) => (a < b ? -1 : 1)).map(([k, member]) => [k, sorted(member, k)])
          .filter(([, member]) => member !== undefined && typeof member !== 'function' && typeof member !== 'symbol'),
      );
    } finally {
      open.delete(v);
    }
  };
  return JSON.stringify(sorted(value, ''));
}
