/**
 * Paint identity as a string: paints with equal keys draw the same, however
 * they were built. Paint is plain data, so the comparison is structural.
 */

import { isSolidPaint } from './commandPaint';
import type { Fill, Paint, Stroke } from './paint';
import { resolveFill, resolveStroke, type PaintedFill, type PaintedStroke } from './resolvePaint';

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

const structuralKeys = new WeakMap<object, string>();
const strokeShapeKeys = new WeakMap<object, string>();

/**
 * A key two paints share only if they draw the same. No paint at all is
 * `'none'`. Two solids that draw the same always share one. A gradient or
 * pattern keys by its fields as written, so one that spells out a default
 * (`opacity: 1`, `units`) keys apart from one that omits it: that splits a
 * group, where merging two that differ would draw one with the other's paint.
 *
 * A gradient or pattern is read once: changed in place after its first use,
 * it keeps the key it had. A solid is read on every call.
 */
export function paintKey(paint: Paint | null | undefined): string {
  if (paint == null) return 'none';
  if (isSolidPaint(paint)) return `solid:${paint.color}:${paint.opacity ?? 1}`;
  let key = structuralKeys.get(paint);
  if (key === undefined) {
    key = canonical(paint);
    structuralKeys.set(paint, key);
  }
  return key;
}

/** Whether a fill puts ink down: it does not when it is absent or holds no paint. */
export function fillHasInk(fill: Fill | null | undefined): fill is PaintedFill {
  return resolveFill(fill) !== null;
}

/** Whether a stroke puts ink down: it does not when it is absent, holds no
 *  paint, or has no width. */
export function strokeHasInk(stroke: Stroke | null | undefined): stroke is PaintedStroke {
  if (resolveStroke(stroke) === null) return false;
  const width = stroke.width ?? 1;
  return (typeof width === 'number' ? width : width.px) > 0;
}

/**
 * A key two strokes share only if they draw the same ribbon over the same
 * geometry. Every stroke that puts no ink down is `'none'`. A `{ px }` width
 * keys apart from the equal world-unit number, which is a different ribbon.
 *
 * Everything but the paint is read once: a stroke whose width, dash, or other
 * shape is changed in place keeps the key it had. Its paint is keyed on every
 * call, as {@link paintKey} keys it.
 */
export function strokeKey(stroke: Stroke | null | undefined): string {
  if (!strokeHasInk(stroke)) return 'none';
  let shape = strokeShapeKeys.get(stroke);
  if (shape === undefined) {
    const { paint: _paint, width, join, cap, miterLimit, align, dash, ...rest } = stroke;
    shape = canonical({
      ...rest,
      width: width ?? 1,
      join: join ?? 'miter',
      cap: cap ?? 'butt',
      miterLimit: miterLimit ?? 4,
      align: align ?? 'center',
      dash: dash ?? [],
    });
    strokeShapeKeys.set(stroke, shape);
  }
  return `${shape}|${paintKey(stroke.paint)}`;
}
