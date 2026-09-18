// Reading and writing the paint objects a property control may be pointed at.
//
// `data.fill` is a `FillStyle` and `data.stroke` a `Stroke`, so a control that
// assumes either is a hex string reads `undefined` off it and writes a bare
// string back over it. These helpers are what keep a control honest about the
// shape it is holding.

/** Whether a value is a `FillStyle` at all: an object naming a kind, or one
 *  carrying a color, which is the solid member with its optional tag left off.
 *  A pref's stored value is `unknown`, so this is what stands between a paint
 *  control and a string someone saved there. */
export function isPaint(value: unknown): value is { fill?: string; color?: string } {
  if (typeof value !== 'object' || value === null) return false;
  const paint = value as { fill?: unknown; color?: unknown };
  return typeof paint.fill === 'string' || typeof paint.color === 'string';
}

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
