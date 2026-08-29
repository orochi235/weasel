import type { Action } from '../registry';
import type { FillStyle, Stroke } from '@weasel-js/paint';
import { createPaintAction } from './createPaintAction';
import { paintWithColor, strokeOf, strokeWith, DEFAULT_STROKE_COLOR } from '../../../util/paint';

/** `setStroke`'s gesture state — `setFill`'s, against a stroke. */
interface SetStrokeState {
  /** May be 6- or 8-char hex. Ignored while `paint` is set. */
  color: string;
  /** `null` is an explicit no-stroke, distinct from `undefined`, which means
   *  this gesture carries no paint and the color applies. */
  paint?: FillStyle | null;
}

/** Repaint a node's stroke, keeping its width, cap, join, dash and align, so
 *  picking a paint does not discard the rest of the stroke. A node with no
 *  stroke yet gets a hairline one. */
function repaint(prev: Stroke | null | undefined, state: SetStrokeState): Stroke | null {
  // A stroke whose paint is none paints nothing, so the whole stroke goes
  // rather than being kept as a widthful thing that draws no ink.
  if (state.paint === null) return null;
  if (state.paint) return prev ? { ...prev, paint: state.paint } : strokeWith(state.paint);
  if (!prev) return strokeOf(state.color);
  return { ...prev, paint: paintWithColor(prev.paint, state.color) };
}

/**
 * Static descriptor for the `setStroke` Action.
 *
 * Takes either `color` (a hex string) or `paint` (a whole `FillStyle`, for
 * gradients and patterns). `paint` wins when both are present. A stroke's
 * width, cap, join, dash and align survive either.
 *
 * Alpha semantics: alpha lives on the stroke paint's `opacity`. A 6-char
 * (no-alpha) color adopts the alpha of the node's existing stroke paint; an
 * 8-char color states its own. A `paint` is written verbatim.
 */
export const setStrokeAction: Action & { requires: string[] } = createPaintAction<
  SetStrokeState,
  Stroke,
  'stroke'
>({
  id: 'setStroke',
  label: 'Set stroke',
  dataKey: 'stroke',
  initialState: (pick) => ({
    color: pick<string>('color') ?? DEFAULT_STROKE_COLOR,
    paint: pick<FillStyle | null>('paint'),
  }),
  readParams: (prev, params) => {
    const color = params?.color as string | undefined;
    const paint = params?.paint as FillStyle | null | undefined;
    if (color === undefined && paint === undefined) return null;
    if (color === undefined) return { ...prev, paint };
    // An explicit color supersedes a paint from an earlier tick; otherwise a
    // picker drag after a gradient would do nothing.
    return { color, paint };
  },
  merge: repaint,
});
