import type { Action } from '@weasel-js/routing';
import type { Stroke } from '@weasel-js/paint';
import { createPaintAction, finiteOr } from './createPaintAction';
import type { OpacityParams } from '@weasel-js/core';
import { paintWithAlpha, solid, DEFAULT_STROKE_COLOR } from '@weasel-js/paint';
import { strokeUnderPaint } from './setStroke';

/**
 * Static descriptor for the `setStrokeOpacity` Action.
 *
 * `params.alpha01` (0..1, ignored unless a finite number) becomes each node's stroke paint `opacity`, leaving
 * the rest of the stroke — color, width, cap, join, dash — alone. A node with
 * no stroke yet gets a hairline one; a stroke set to None (`null`, or a stroke
 * with no `paint`) stays None.
 */
export const setStrokeOpacityAction: Action = createPaintAction<
  number,
  Stroke,
  'stroke',
  OpacityParams
>({
  id: 'setStrokeOpacity',
  label: 'Set stroke opacity',
  dataKey: 'stroke',
  initialState: (pick) => finiteOr(pick('alpha01'), 1),
  readParams: (_prev, params) => finiteOr(params?.alpha01, null),
  merge: (prev, alpha01) => {
    if (prev === null || (prev !== undefined && prev.paint == null)) return prev;
    const base = strokeUnderPaint(prev);
    return { ...base, paint: paintWithAlpha(base.paint ?? solid(DEFAULT_STROKE_COLOR), alpha01) };
  },
});
