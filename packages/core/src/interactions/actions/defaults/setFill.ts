import type { Action } from '../registry';
import type { FillStyle } from '@weasel-js/paint';
import { createPaintAction } from './createPaintAction';
import { paintWithColor, DEFAULT_FILL_COLOR } from '../../../util/paint';

/** `setFill`'s gesture state. A `paint` shadows the color until a later color
 *  supersedes it. */
interface SetFillState {
  /** May be 6- or 8-char hex. Ignored while `paint` is set. */
  color: string;
  /** `null` is an explicit no-fill, distinct from `undefined`, which means
   *  this gesture carries no paint and the color applies. */
  paint?: FillStyle | null;
}

/**
 * Static descriptor for the `setFill` Action.
 *
 * Takes either `color` (a hex string) or `paint` (a whole `FillStyle`, for
 * gradients and patterns). `paint` wins when both are present.
 *
 * Alpha semantics: alpha lives on the paint's `opacity`. A 6-char (no-alpha)
 * color adopts the alpha of the node's existing paint; an 8-char color states
 * its own. A `paint` is written verbatim.
 */
export const setFillAction: Action & { requires: string[] } = createPaintAction<
  SetFillState,
  FillStyle,
  'fill'
>({
  id: 'setFill',
  label: 'Set fill',
  dataKey: 'fill',
  initialState: (pick) => ({
    color: pick<string>('color') ?? DEFAULT_FILL_COLOR,
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
  // `??` would read an explicit no-fill as "no paint given" and repaint the
  // node with the state's color, so absence has to be tested for.
  merge: (prev, state) => (state.paint !== undefined
    ? state.paint
    : paintWithColor(prev ?? undefined, state.color)),
});
