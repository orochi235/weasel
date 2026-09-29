import type { BindingOpts } from '@weasel-js/routing';
import type { InsertBehavior } from 'interactions/gestures/types';

/** Options every drag-to-insert tool takes. */
export interface InsertToolOptions {
  /** Behaviors `insertAction` runs over the drag's start and current point
   *  (e.g. `@weasel-js/guides`' `snapToGrid`, `alignInsertBehavior`), in order. Keep
   *  the array stable across renders: a new one rebuilds the tool. */
  behaviors?: readonly InsertBehavior<unknown>[];
}

/** The insert binding's `opts.behaviors` entry, left out when there are none. */
export function insertBindingBehaviors(
  behaviors: InsertToolOptions['behaviors'],
): Pick<BindingOpts, 'behaviors'> {
  return behaviors?.length ? { behaviors: [...behaviors] } : {};
}
