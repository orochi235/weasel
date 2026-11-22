import type { Action } from '@weasel-js/routing';
import type { Fill } from '@weasel-js/paint';
import { createPaintAction } from './createPaintAction';
import { colorPaintReader, type ColorPaintState } from './colorPaintState';
import type { PaintParams } from '@weasel-js/core';
import { paintWithColor, DEFAULT_FILL_COLOR } from '@weasel-js/paint';

/** Repaint a node's fill, keeping whatever else the fill carries. None is
 *  that record without its `paint`. */
function repaint(prev: Fill | null | undefined, state: ColorPaintState): Fill | null {
  if (state.paint === null) {
    if (prev == null) return null;
    const { paint: _dropped, ...rest } = prev;
    return rest;
  }
  return { ...prev, paint: state.paint ?? paintWithColor(prev?.paint, state.color) };
}

/**
 * Static descriptor for the `setFill` Action.
 *
 * Takes either `color` (a hex string) or `paint` (a whole `Paint`, for
 * gradients and patterns). `paint` wins when both are present.
 *
 * Alpha semantics: alpha lives on the paint's `opacity`. A 6-char (no-alpha)
 * color adopts the alpha of the node's existing paint; an 8-char color states
 * its own. A `paint` is written verbatim.
 */
export const setFillAction: Action = createPaintAction<
  ColorPaintState,
  Fill,
  'fill',
  PaintParams
>({
  id: 'setFill',
  label: 'Set fill',
  dataKey: 'fill',
  ...colorPaintReader(DEFAULT_FILL_COLOR),
  merge: repaint,
});
