import { strokeWith, type InsertPaint } from '@weasel-js/core';
import { type ActivePaint, toFillStyle } from './ActiveSwatches';

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
    const paint = toFillStyle(stroke);
    return {
      fill: STROKE_ONLY.has(kind) ? null : toFillStyle(fill),
      stroke: paint === null ? null : strokeWith(paint, NEW_STROKE_WIDTH),
    };
  };
}
