/** Option surface for the `lasso-select` action. */

import type { LassoSelectBehavior } from '../../gestures/types';

/** Options for the `lasso-select` action. */
export interface UseLassoSelectOptions {
  behaviors?: LassoSelectBehavior[];
  /** Skip vertices closer than this many world-px to the previous one.
   *  Default 2. Set 0 to record every move sample. */
  minVertexSpacing?: number;
}
