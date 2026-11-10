import type { BindingOpts, ToolOptionShare } from '@weasel-js/routing';
import type { InsertBehavior } from 'interactions/gestures/types';

/** Options every drag-to-insert tool takes. */
export interface InsertToolOptions {
  /** Behaviors `insertAction` runs over the drag's start and current point
   *  after the snap session, in order. Keep the array stable across renders:
   *  a new one rebuilds the tool. */
  behaviors?: readonly InsertBehavior<unknown>[];
  /** Laid over the tool's own option shares: `{ fill: null }` keeps this
   *  tool's fill its own rather than the one every shape tool shares. Keep it
   *  stable across renders: a new one rebuilds the tool. */
  share?: ToolOptionShare;
}

/** The insert binding's `opts.behaviors` entry, left out when there are none. */
export function insertBindingBehaviors(
  behaviors: InsertToolOptions['behaviors'],
): Pick<BindingOpts, 'behaviors'> {
  return behaviors?.length ? { behaviors: [...behaviors] } : {};
}
