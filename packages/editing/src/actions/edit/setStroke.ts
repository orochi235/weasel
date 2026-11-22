import type { Action } from '@weasel-js/routing';
import type { Stroke } from '@weasel-js/paint';
import { createPaintAction } from './createPaintAction';
import { colorPaintReader, type ColorPaintState } from './colorPaintState';
import type { PaintParams } from '@weasel-js/core';
import { paintWithColor, DEFAULT_STROKE_COLOR } from '@weasel-js/paint';

/** Repaint a node's stroke, keeping its width, cap, join, dash and align, so
 *  picking a paint does not discard the rest of the stroke, and None keeps
 *  them for the next paint. A node with no stroke yet gets a hairline one. */
function repaint(prev: Stroke | null | undefined, state: ColorPaintState): Stroke | null {
  if (state.paint === null) {
    if (prev == null) return null;
    const { paint: _dropped, ...rest } = prev;
    return rest;
  }
  return { ...strokeUnderPaint(prev), paint: state.paint ?? paintWithColor(prev?.paint, state.color) };
}

/** The stroke a new paint goes onto: `prev`, or a hairline when it has neither a paint nor a width yet. */
export function strokeUnderPaint(prev: Stroke | null | undefined): Stroke {
  return prev == null || (prev.paint == null && prev.width === undefined) ? { ...prev, width: 1 } : prev;
}

/**
 * Static descriptor for the `setStroke` Action.
 *
 * Takes either `color` (a hex string) or `paint` (a whole `Paint`, for
 * gradients and patterns). `paint` wins when both are present. A stroke's
 * width, cap, join, dash and align survive either.
 *
 * Alpha semantics: alpha lives on the stroke paint's `opacity`. A 6-char
 * (no-alpha) color adopts the alpha of the node's existing stroke paint; an
 * 8-char color states its own. A `paint` is written verbatim.
 */
export const setStrokeAction: Action = createPaintAction<
  ColorPaintState,
  Stroke,
  'stroke',
  PaintParams
>({
  id: 'setStroke',
  label: 'Set stroke',
  dataKey: 'stroke',
  ...colorPaintReader(DEFAULT_STROKE_COLOR),
  merge: repaint,
});
