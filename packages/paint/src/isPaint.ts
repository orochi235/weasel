/** Whether a value is a `Paint` at all: an object naming a kind, or one carrying a color, which is the solid
 *  member with its optional tag left off. What stands between code expecting a paint and a value read from
 *  storage or a file, which may be anything. */
export function isPaint(value: unknown): value is { kind?: string; color?: string } {
  if (typeof value !== 'object' || value === null) return false;
  const paint = value as { kind?: unknown; color?: unknown };
  return typeof paint.kind === 'string' || typeof paint.color === 'string';
}
