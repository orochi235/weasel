// Reading and writing the paint unions a property control may be pointed at.
//
// `data.fill` is `string | FillStyle` and `data.stroke` is `string | Stroke`,
// so a control that assumes either is a hex string reads `undefined` off the
// object form and writes a bare string back over it. These helpers are what
// keep a control honest about which form it is holding.

/** The color of a solid paint, or `undefined` for anything else — including a
 *  value that isn't a paint at all. `fill` is optional on the solid member of
 *  the union, so the tag alone can't decide it. */
export function solidColorOf(value: unknown): string | undefined {
  if (typeof value !== 'object' || value === null) return undefined;
  const paint = value as { fill?: string; color?: unknown };
  if (paint.fill !== undefined && paint.fill !== 'solid') return undefined;
  return typeof paint.color === 'string' ? paint.color : undefined;
}

/** True when the value is the object form of a stroke rather than a color. */
export function isStrokeObject(value: unknown): value is { paint: unknown } {
  return typeof value === 'object' && value !== null && 'paint' in value;
}

/** The single color a stroke shows, or `undefined` when it has none to show —
 *  a gradient or pattern stroke, or no stroke at all. */
export function strokeColorOf(value: unknown): string | undefined {
  if (typeof value === 'string') return value;
  if (isStrokeObject(value)) return solidColorOf(value.paint);
  return undefined;
}

/** Apply a color without changing which form the stroke is in. A string stays
 *  a string; an object keeps its width, cap, join, dash and align and takes a
 *  new solid paint, so picking a color doesn't silently discard the rest. */
export function strokeWithColor(prev: unknown, color: string): unknown {
  if (isStrokeObject(prev)) return { ...prev, paint: { fill: 'solid', color } };
  return color;
}
