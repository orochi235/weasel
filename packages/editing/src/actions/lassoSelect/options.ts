/** Option surface for the `lasso-select` action. */

import type { LassoHitMode, LassoSelectBehavior } from '@weasel-js/core/engine';

/** Options for the `lasso-select` action. */
export interface UseLassoSelectOptions {
  behaviors?: LassoSelectBehavior[];
  /** Skip vertices closer than this many screen px to the previous one.
   *  Default 2. Set 0 to record every move sample. */
  minVertexSpacing?: number;
  /** Hit mode for the action's own selection commit, which runs when no
   *  behavior claims the gesture. A behavior carries its own, as
   *  `selectFromLasso({ mode })` does. Default 'intersect'. */
  mode?: LassoHitMode;
}
