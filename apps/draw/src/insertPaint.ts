import { strokeWith, type InsertPaint } from '@weasel-js/core';
import { type ActivePaint, toPaint } from './ActiveSwatches';

const NEW_STROKE_WIDTH = 2;

/** Open shapes: nothing to fill, so a new one is its stroke alone. */
const STROKE_ONLY = new Set(['line', 'pencil']);

/**
 * The paint of a newly drawn shape: the swatches' active fill and stroke, read
 * when the shape is inserted.
 */
export function activeInsertPaint(active: () => { fill: ActivePaint; stroke: ActivePaint }): InsertPaint {
  return (kind) => {
    const { fill, stroke } = active();
    const fillPaint = toPaint(fill);
    const strokePaint = toPaint(stroke);
    return {
      fill: STROKE_ONLY.has(kind) || fillPaint === null ? null : { paint: fillPaint },
      stroke: strokePaint === null ? null : strokeWith(strokePaint, NEW_STROKE_WIDTH),
    };
  };
}
