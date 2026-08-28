// Reading and writing the paint objects a property control may be pointed at.
//
// `data.fill` is a `FillStyle` and `data.stroke` a `Stroke`, so a control that
// assumes either is a hex string reads `undefined` off it and writes a bare
// string back over it. These helpers are what keep a control honest about the
// shape it is holding.

/** The color of a solid paint, or `undefined` for anything else — including a
 *  value that isn't a paint at all. `fill` is optional on the solid member of
 *  the union, so the tag alone can't decide it. */
export function solidColorOf(value: unknown): string | undefined {
  if (typeof value !== 'object' || value === null) return undefined;
  const paint = value as { fill?: string; color?: unknown };
  if (paint.fill !== undefined && paint.fill !== 'solid') return undefined;
  return typeof paint.color === 'string' ? paint.color : undefined;
}

/** The single color a stroke shows, or `undefined` when it has none to show —
 *  a gradient or pattern stroke, or no stroke at all. */
export function strokeColorOf(value: unknown): string | undefined {
  if (typeof value !== 'object' || value === null || !('paint' in value)) return undefined;
  return solidColorOf((value as { paint: unknown }).paint);
}
