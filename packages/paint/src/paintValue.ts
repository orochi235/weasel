// Reading and writing the paint objects a property control may be pointed at.
//
// `data.fill` is a `Fill` and `data.stroke` a `Stroke`, each holding a `Paint`,
// so a control that assumes either is a hex string reads `undefined` off it and
// writes a bare string back over it. These helpers are what keep a control
// honest about the shape it is holding.

import { isSolidPaint } from './commandPaint';
import { isPaint } from './isPaint';
import type { Paint } from './paint';

/** The paint slots a node carries, `fill` and `stroke`. Either may hold any
 *  paint, and each has its own action. */
export type PaintSlot = 'fill' | 'stroke';

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
