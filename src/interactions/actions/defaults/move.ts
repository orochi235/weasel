/**
 * `moveAction` — first `ongoing`-timing Action descriptor (Phase 6 Task 1).
 *
 * Mirrors the per-frame translate semantics of the `useMove` hook:
 *   - `start`: capture origin poses for all selected nodes; record the
 *     current drag delta in scratch each frame.
 *   - `onMove`: update the in-scratch `currentDelta` only — no scene writes.
 *     This avoids polluting the undo stack with O(N-frames) entries.
 *   - `onEnd('commit')`: apply the final delta via `scene.batch('Move', ...)`,
 *     which produces exactly one undo entry for the whole drag.
 *   - `onEnd('cancel')`: no scene writes — the scene was never mutated during
 *     the drag, so no restoration is needed.
 *
 * ## Why no per-frame scene writes
 *
 * `Scene.setPose` calls `executeAndLog` → `pushEntry`, which immediately
 * appends to the undo stack. Per-frame writes during drag would create
 * O(frames) history entries — matching `useMove`'s approach of tracking
 * poses only in React state (overlay) during the drag and committing a
 * single `createTransformOp` batch at the end.
 *
 * ## Design decisions vs `useMove`
 *
 * `useMove` uses `MoveAdapter` + a React overlay to render ghost positions
 * during the drag. `moveAction` has no overlay surface in Phase 6 — the
 * descriptor tracks delta in scratch and writes to the scene only at commit.
 * This means the canvas does not show live drag feedback until the overlay
 * system is wired (Phase 7 TODO).
 *
 * Features deferred to Phase 7:
 * - Live drag overlay / ghost rendering.
 * - Behavior pipeline (snap-to-grid, snap-back-or-delete, etc.) via
 *   `opts.behaviors` from `BindingOpts`.
 * - Cascading children / group expansion (requires `getChildren` surface).
 *
 * ## Pose generics
 *
 * `scene` dep is typed `Scene<unknown, string, unknown>` (the erased DepSchema
 * entry). Poses are read and written as `unknown`; `translatePoseGeneric`
 * delegates to `RECT_POSE_DESCRIPTOR.translate` which treats any pose as
 * `{x, y, ...}`. Consumers with non-rect poses should register a custom
 * action with a typed translatePose.
 */

import type { Action } from '../registry';
import { ActionDisabledReason } from '../registry';
import type { InvocationCtx, OngoingHandle } from '../invoker';
import type { Scene, NodeId } from 'core/scene/types';
import type { SelectionApi } from 'core/selection/useSelection';
import { RECT_POSE_DESCRIPTOR } from '../resize/geometry';

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/** Translate a pose by (dx, dy) using the rect-pose default. */
function translatePoseGeneric(pose: unknown, dx: number, dy: number): unknown {
  return (RECT_POSE_DESCRIPTOR.translate as (p: unknown, dx: number, dy: number) => unknown)(pose, dx, dy);
}

// ---------------------------------------------------------------------------
// Internal scratch
// ---------------------------------------------------------------------------

interface MoveScratch {
  /** Origin poses captured at drag start. Key is NodeId. */
  startPoses: Map<NodeId, unknown>;
  ids: NodeId[];
  scene: Scene<unknown, string, unknown>;
  /** Running drag delta — updated each onMove, applied once at commit. */
  currentDelta: { dx: number; dy: number };
}

// ---------------------------------------------------------------------------
// Descriptor
// ---------------------------------------------------------------------------

/**
 * @experimental
 * Static descriptor for the `move` Action.
 *
 * Requires dep-schema entries: `selection`, `scene`.
 *
 * The invoker is `ongoing` — it returns an `OngoingHandle` from `start` that
 * the dispatcher pumps via `onMove`/`onEnd` for the duration of the drag.
 *
 * @see useMove — the React hook this descriptor mirrors for the simple case.
 */
export const moveAction: Action & { requires: string[] } = {
  id: 'move',
  label: 'Move',
  gestureBinding: { kind: 'drag' },
  requires: ['selection', 'scene'],
  invoker: {
    timing: 'ongoing',
    start(ctx: InvocationCtx, _opts): OngoingHandle {
      const selection = ctx.deps.selection as SelectionApi | undefined;
      const scene = ctx.deps.scene as Scene<unknown, string, unknown> | undefined;

      if (!selection || !scene) return {};

      const ids = selection.get() as NodeId[];
      if (ids.length === 0) return {};

      // Capture origin poses once at drag start.
      const startPoses = new Map<NodeId, unknown>();
      for (const id of ids) {
        const node = scene.get(id);
        if (node) startPoses.set(id, node.pose);
      }

      const scratch: MoveScratch = {
        startPoses,
        ids,
        scene,
        currentDelta: { dx: 0, dy: 0 },
      };

      return {
        onMove(moveCtx: InvocationCtx): void {
          if (!moveCtx.drag) return;
          // Track delta in scratch only — no scene writes, no history entries.
          scratch.currentDelta = {
            dx: moveCtx.drag.delta.x,
            dy: moveCtx.drag.delta.y,
          };
        },
        onEnd(_endCtx: InvocationCtx, reason: 'commit' | 'cancel'): void {
          if (reason === 'cancel') {
            // Scene was never mutated during drag; nothing to restore.
            return;
          }
          // 'commit': apply final delta as a single batch → one undo entry.
          const { dx, dy } = scratch.currentDelta;
          // No-op if no movement (sub-threshold drag or zero delta).
          if (dx === 0 && dy === 0) return;
          scratch.scene.batch('Move', () => {
            for (const id of scratch.ids) {
              const origin = scratch.startPoses.get(id);
              if (origin === undefined) continue;
              scratch.scene.setPose(id, translatePoseGeneric(origin, dx, dy));
            }
          });
        },
      };
    },
  },
  /**
   * `enabled` is a zero-arg thunk (see `Action.enabled` JSDoc). It cannot
   * access live deps — the predicate is evaluated by the command palette on
   * open, not by the dispatcher at invocation time. Return a static
   * `SelectionRequired` placeholder; the invoker's `start` self-guards by
   * returning `{}` when selection is empty.
   *
   * Phase 7 TODO: extend `Action.enabled` to accept a deps snapshot so
   * ongoing descriptors can report live enabled state.
   */
  enabled: () => ActionDisabledReason.SelectionRequired,
};
