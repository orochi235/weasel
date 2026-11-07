/**
 * JSON with object keys sorted, so two equal values produce one string. What JSON cannot write and would throw on
 * is written with the tags devtools serialization uses: a bigint as `{"$type":"bigint","value":"10"}`, a reference
 * to an object that contains it as `{"$type":"cycle"}`.
 */
export function stableStringify(value: unknown): string {
  const open = new Set<object>();
  const sorted = (v: unknown): unknown => {
    if (typeof v === 'bigint') return { $type: 'bigint', value: v.toString() };
    if (v === null || typeof v !== 'object') return v;
    const json = (v as { toJSON?: unknown }).toJSON;
    if (typeof json === 'function') return sorted((json as () => unknown).call(v));
    if (open.has(v)) return { $type: 'cycle' };
    open.add(v);
    try {
      if (Array.isArray(v)) return v.map(sorted);
      return Object.fromEntries(
        Object.entries(v).sort(([a], [b]) => (a < b ? -1 : 1)).map(([key, member]) => [key, sorted(member)]),
      );
    } finally {
      open.delete(v);
    }
  };
  return JSON.stringify(sorted(value));
}
