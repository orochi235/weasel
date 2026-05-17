/** Option surface for the `area-select` action.
 *
 *  Lives in a sibling file (not `areaSelect.ts`) so the type contract stays
 *  stable even after the legacy `useAreaSelect` hook is deleted in Phase 14e
 *  Task 4. Consumers should import from here directly; `areaSelect.ts`
 *  re-exports the same symbol for back-compat. */

import type { AreaSelectBehavior } from '../../gestures/types';
import type { DebugSink } from '../../../debug/types';

export interface UseAreaSelectOptions {
  behaviors?: AreaSelectBehavior[];
  /** When set, overrides any behavior's `defaultTransient`. Default: behaviors decide. */
  transient?: boolean;
  /** Label used when transient is false and the hook falls back to applyOps. Default 'Area select'. */
  label?: string;
  onGestureStart?: () => void;
  onGestureEnd?: (committed: boolean) => void;
  /** Optional debug sink. When supplied, records the in-progress marquee
   *  rectangle as a `bounds` entry under the synthetic id `'area-select'`
   *  on every move. Tree-shakes via optional-chain when omitted. */
  debug?: DebugSink;
}
