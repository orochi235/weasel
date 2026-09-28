/** Option surface for the `move` action. */

import type { MoveBehavior } from '../../gestures/types';

/** Options for the `move` action: the behaviors (snapping, momentum) layered
 *  over the raw drag, the ids a drag carries, and its history and lifecycle.
 *  `selectionMoveBindings` threads them into the move bindings. */
export interface UseMoveOptions<TPose> {
  behaviors?: MoveBehavior<TPose>[];
  /** Screen travel, in CSS pixels, before the drag moves anything. Default
   *  `DRAG_THRESHOLD_PX`. The dispatcher opens no drag before that, so a
   *  smaller value has no effect; a larger one holds the selection in place
   *  until the pointer has gone that far. */
  dragThresholdPx?: number;
  /** History label for the committed move. Unset, a behavior's or a layout
   *  drop's own op label names it, else `'Move'`. */
  moveLabel?: string;
  /** Commit without an undo entry (`scene.untracked`), bypassing the
   *  consumer `applyOps` hook. Unset, a behavior's `defaultTransient` decides. */
  transient?: boolean;
  /** Fired once the drag passes its threshold, with the ids it moves. */
  onGestureStart?(ids: string[]): void;
  /** Fired once per `onGestureStart`: `true` when the move wrote to the
   *  document, `false` on cancel, a behavior abort, or no net movement. */
  onGestureEnd?(committed: boolean): void;
  /** Replace the selection with the ids the drag moves — to carry linked
   *  nodes along, say. Called once at drag start; the result is what
   *  behaviors see as `draggedIds` and what the commit writes (each id's
   *  descendants follow it as usual). Returning `[]` declines the drag.
   *  Default: the selection. */
  expandIds?: (ids: string[]) => string[];
}
