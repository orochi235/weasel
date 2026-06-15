/** Option surface for the `lasso-select` action.
 *
 *  Lives in a sibling file (not `lassoSelect.ts`) so the type contract stays
 *  stable even after the legacy `useLassoSelect` hook is gone.
 *  Consumers should import from here directly; `lassoSelect.ts`
 *  re-exports the same symbol for back-compat. */

import type { LassoSelectBehavior } from '../../gestures/types';
import type { DebugSink } from '../../../debug/types';

export interface UseLassoSelectOptions {
  behaviors?: LassoSelectBehavior[];
  /** When set, overrides any behavior's `defaultTransient`. */
  transient?: boolean;
  /** Label used when transient is false and the hook falls back to applyOps. Default 'Lasso select'. */
  label?: string;
  onGestureStart?: () => void;
  onGestureEnd?: (committed: boolean) => void;
  /** Skip vertices closer than this many world-px to the previous one.
   *  Default 2. Set 0 to record every move sample. */
  minVertexSpacing?: number;
  /** Optional debug sink; receives the live polygon AABB on every move. */
  debug?: DebugSink;
}
