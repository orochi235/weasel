/**
 * The params editing's own actions read, merged into routing's
 * `ActionParamSchema` so `<SceneCanvas tune>` types them.
 */
import type { WorldPoint } from '@weasel-js/routing';
import type { AlignReference } from './actions/align/align';
import type { DistributeMode } from './actions/distribute/distribute';
import type { FlipAxis, FlipPivot } from './actions/flip/helpers';

/** `align.*`'s params. */
export type AlignParams = {
  /** The point a reference of `'pointer'` resolves to in place of the pointer dep. */
  world?: WorldPoint;
  /** Default the selection. */
  to?: AlignReference;
};
/** `flip`'s params. */
export type FlipParams = {
  /** The point a pivot of `'pointer'` resolves to in place of the pointer dep. */
  world?: WorldPoint;
  /** Default `'x'`. */
  axis?: FlipAxis;
  /** Default `'each'`. */
  pivot?: FlipPivot;
};
/** A `distribute.*` action's params: what it spaces evenly. */
export type DistributeParams = { mode?: DistributeMode };
/** A reorder action's params: one step, or all the way to the front or back. */
export type ReorderParams = { distance?: 'adjacent' | 'extreme' };

declare module '@weasel-js/routing' {
  interface ActionParamSchema {
    'align.left': AlignParams;
    'align.centerX': AlignParams;
    'align.right': AlignParams;
    'align.top': AlignParams;
    'align.centerY': AlignParams;
    'align.bottom': AlignParams;
    flip: FlipParams;
    'distribute.horizontal': DistributeParams;
    'distribute.vertical': DistributeParams;
    'reorder.forward': ReorderParams;
    'reorder.backward': ReorderParams;
  }
}
