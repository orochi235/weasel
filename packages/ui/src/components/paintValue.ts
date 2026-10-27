// Reading and writing the paint objects a property control may be pointed at.
//
// `data.fill` is a `Fill` and `data.stroke` a `Stroke`, each holding a `Paint`,
// so a control that assumes either is a hex string reads `undefined` off it and
// writes a bare string back over it. These helpers are what keep a control
// honest about the shape it is holding.

import { isSolidPaint, type Paint } from '@weasel-js/paint';

/** Whether a value is a `Paint` at all: an object naming a kind, or one
 *  carrying a color, which is the solid member with its optional tag left off.
 *  A pref's stored value is `unknown`, so this is what stands between a paint
 *  control and a string someone saved there. */
export function isPaint(value: unknown): value is { kind?: string; color?: string } {
  if (typeof value !== 'object' || value === null) return false;
  const paint = value as { kind?: unknown; color?: unknown };
  return typeof paint.kind === 'string' || typeof paint.color === 'string';
}

/** The color of a solid paint, or `undefined` for anything else — including a
 *  value that isn't a paint at all. */
export function solidColorOf(value: unknown): string | undefined {
  if (!isPaint(value) || !isSolidPaint(value as Paint)) return undefined;
  return typeof value.color === 'string' ? value.color : undefined;
}

/** The single color a stroke shows, or `undefined` when it has none to show —
 *  a gradient or pattern stroke, or no stroke at all. */
export function strokeColorOf(value: unknown): string | undefined {
  if (typeof value !== 'object' || value === null || !('paint' in value)) return undefined;
  return solidColorOf((value as { paint: unknown }).paint);
}
