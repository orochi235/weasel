/**
 * Paint identity as a string: two paints that draw the same share a key,
 * however they were built. Paint is plain data, so the comparison is
 * structural; the key is kept per object, so asking again costs a lookup.
 */

import { isSolidPaint } from './commandPaint';
import type { Fill, Paint, Stroke } from './paint';

/** `value` as JSON with every object's keys sorted and its `undefined`
 *  fields dropped, so field order and an explicit `undefined` cannot tell
 *  two equal values apart. */
function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (typeof value !== 'object' || value === null) return JSON.stringify(value) ?? 'null';
  const fields = Object.keys(value).sort()
    .filter((k) => (value as Record<string, unknown>)[k] !== undefined)
    .map((k) => `${JSON.stringify(k)}:${canonical((value as Record<string, unknown>)[k])}`);
  return `{${fields.join(',')}}`;
}

const paintKeys = new WeakMap<object, string>();
const strokeKeys = new WeakMap<object, string>();

/**
 * A key equal for exactly the paints that draw the same. No paint at all is
 * `'none'`. A paint object is read once, so one changed in place keeps the
 * key it had.
 */
export function paintKey(paint: Paint | null | undefined): string {
  if (paint == null) return 'none';
  let key = paintKeys.get(paint);
  if (key === undefined) {
    key = isSolidPaint(paint)
      ? `solid:${paint.color}:${paint.opacity ?? 1}`
      : canonical(paint);
    paintKeys.set(paint, key);
  }
  return key;
}

/** Whether a fill puts ink down: it does not when it is absent or holds no paint. */
export function fillHasInk(fill: Fill | null | undefined): fill is Fill & { paint: Paint } {
  return fill?.paint !== undefined;
}

/** Whether a stroke puts ink down: it does not when it is absent, holds no
 *  paint, or has no width. */
export function strokeHasInk(stroke: Stroke | null | undefined): stroke is Stroke & { paint: Paint } {
  if (stroke?.paint === undefined) return false;
  const width = stroke.width ?? 1;
  return (typeof width === 'number' ? width : width.px) > 0;
}

/**
 * A key equal for exactly the strokes that draw the same ribbon over the same
 * geometry. Every stroke that puts no ink down is `'none'`. A `{ px }` width
 * keys apart from the equal world-unit number, which is a different ribbon.
 */
export function strokeKey(stroke: Stroke | null | undefined): string {
  if (!strokeHasInk(stroke)) return 'none';
  let key = strokeKeys.get(stroke);
  if (key === undefined) {
    const { paint, width, join, cap, miterLimit, align, dash, ...rest } = stroke;
    key = canonical({
      ...rest,
      paint: paintKey(paint),
      width: width ?? 1,
      join: join ?? 'miter',
      cap: cap ?? 'butt',
      miterLimit: miterLimit ?? 4,
      align: align ?? 'center',
      dash: dash ?? [],
    });
    strokeKeys.set(stroke, key);
  }
  return key;
}
