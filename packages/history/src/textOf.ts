/** `v` as text for a message, which never throws: a BigInt, a cycle, or a throwing `toString` included. */
export function textOf(v: unknown): string {
  if (typeof v === 'string') return JSON.stringify(v);
  if (typeof v === 'bigint') return `${v}n`;
  if (v === null || typeof v !== 'object' && typeof v !== 'function') return String(v);
  try {
    return String(v);
  } catch {
    return `an ${typeof v} that cannot be shown`;
  }
}
