import type { Action } from '../registry';
import type { FillStyle } from 'core/paint-types';
import { createPaintAction } from './createPaintAction';
import { paintWithAlpha, solid, DEFAULT_FILL_COLOR } from '../../../util/paint';

/**
 * Static descriptor for the `setFillOpacity` Action.
 *
 * `params.alpha01` (0..1) becomes each node's fill paint `opacity`, leaving
 * the rest of the paint — color, gradient stops, pattern — alone. That is the
 * one alpha slot a gradient or a pattern has, so it is the slot all of them
 * use. A node with no fill yet takes the kit's default one.
 */
export const setFillOpacityAction: Action & { requires: string[] } = createPaintAction<
  number,
  FillStyle,
  'fill'
>({
  id: 'setFillOpacity',
  label: 'Set fill opacity',
  dataKey: 'fill',
  initialState: (pick) => pick<number>('alpha01') ?? 1,
  readParams: (_prev, params) => (params?.alpha01 as number | undefined) ?? null,
  merge: (prev, alpha01) => paintWithAlpha(prev ?? solid(DEFAULT_FILL_COLOR), alpha01),
});
