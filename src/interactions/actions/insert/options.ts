/** Option surface for the `insert` action.
 *
 *  Lives in a sibling file (not `insert.ts`) so the type contract stays stable
 *  even after the legacy `useInsert` hook is deleted in Phase 14e Task 4.
 *  Consumers should import from here directly; `insert.ts` re-exports the
 *  same symbol for back-compat. */

import type { Op } from 'core/ops/types';
import type { InsertBehavior, ResizePose } from '../../gestures/types';

export interface UseInsertOptions<TPose, TNode extends { id: string } = { id: string }> {
  behaviors?: InsertBehavior<TPose>[];
  insertLabel?: string;
  /** Reserved; insert is never transient in practice. Ignored. */
  transient?: boolean;
  /** Strictly-greater-than thresholds; bounds with width <= or height <= abort. Default { width: 0, height: 0 }. */
  minBounds?: { width: number; height: number };
  /** Construct the in-flight pose from the drag bounds. Defaults to the
   *  identity cast (treat bounds as TPose). Override for non-rect TPose
   *  (e.g. `(b) => rectPath(b)` or a polygon factory). */
  posefromBounds?: (bounds: ResizePose) => TPose;
  /** Click / sub-threshold-drag fallback. When provided, a release whose
   *  bounds fall <= minBounds calls `pointInsert(start)` instead of aborting.
   *  Returning null aborts. The created object is dispatched as an InsertOp
   *  under the same `insertLabel`. */
  pointInsert?: (point: { x: number; y: number }) => TNode | null;
  /** Drag-disabled mode. When true, every release routes to pointInsert(start)
   *  regardless of bounds — commitInsert is never called. Used by tool hooks
   *  that wire only pointer.onClick (no marquee). */
  clickOnly?: boolean;
  /** Override for op dispatch on commit. When set, this is called instead of
   *  `dispatchApplyBatch(adapter, ...)`. Tool hooks that synthesize an adapter
   *  but want commits to route through the active tool ctx's `applyOps`
   *  (for history integration) supply a function that reads from a ref
   *  captured on handler entry. Read fresh on every commit, so a ref-reader
   *  works without retriggering memos. */
  applyOps?: (ops: Op[], label: string) => void;
  onGestureStart?: () => void;
  onGestureEnd?: (committed: boolean) => void;
  /** Optional: snap world-space points to the active grid (or any other
   *  snap target). Applied to every coord the gesture ingests, so both the
   *  live marquee overlay and the committed bounds track the snapped
   *  values. When omitted, behavior is identical to today (identity
   *  passthrough). */
  snapPoint?: (p: { x: number; y: number }) => { x: number; y: number };
}
