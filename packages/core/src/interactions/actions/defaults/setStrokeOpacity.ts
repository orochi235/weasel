import type { Action } from '../registry';
import type { Stroke } from '@weasel-js/paint';
import { createPaintAction } from './createPaintAction';
import { paintWithAlpha, strokeOf, DEFAULT_STROKE_COLOR } from '../../../util/paint';

/**
 * Static descriptor for the `setStrokeOpacity` Action.
 *
 * `params.alpha01` (0..1) becomes each node's stroke paint `opacity`, leaving
 * the rest of the stroke — color, width, cap, join, dash — alone. A node with
 * no stroke yet gets a hairline one.
 */
export const setStrokeOpacityAction: Action & { requires: string[] } = createPaintAction<
  number,
  Stroke,
  'stroke'
>({
  id: 'setStrokeOpacity',
  label: 'Set stroke opacity',
  dataKey: 'stroke',
  initialState: (pick) => pick<number>('alpha01') ?? 1,
  readParams: (_prev, params) => (params?.alpha01 as number | undefined) ?? null,
  merge: (prev, alpha01) => {
    const base = prev ?? strokeOf(DEFAULT_STROKE_COLOR);
    return { ...base, paint: paintWithAlpha(base.paint, alpha01) };
  },
});
