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
  /** Origin poses captured at drag start. Key is NodeId. Includes both
   *  selected roots AND their descendant ids — when a container moves, the
   *  preview-ghost layer needs every child's pose to render the subtree at
   *  the previewed location (clipped to the container silhouette). */
  startPoses: Map<NodeId, unknown>;
  /** Selected ids only — the roots whose pose actually changes at commit.
   *  Descendants follow implicitly under local-pose semantics (a child's
   *  local pose is unchanged when its parent's local pose moves), so we
   *  do NOT write descendant poses to scene at commit. */
  ids: NodeId[];
  /** Descendant ids cascaded for preview only. Their preview poses are
   *  computed each frame so container drags show children moving along. */
  cascadeIds: NodeId[];
  scene: Scene<unknown, string, unknown>;
  /** Running drag delta — updated each onMove, applied once at commit. */
  currentDelta: { dx: number; dy: number };
  /** In-flight preview poses keyed by node id (roots + cascaded children).
   *  Populated on onMove; cleared on onEnd. Read by `previewIds`/`previewPose`. */
  previews: Map<NodeId, unknown>;
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
  defaultBinding: { kind: 'drag' },
  requires: ['selection', 'scene'],
  invoker: {
    timing: 'ongoing',
    start(ctx: InvocationCtx, _opts): OngoingHandle {
      const selection = ctx.deps.selection as SelectionApi | undefined;
      const scene = ctx.deps.scene as Scene<unknown, string, unknown> | undefined;

      if (!selection || !scene) return {};

      const ids = selection.get() as NodeId[];
      if (ids.length === 0) return {};

      // Capture origin poses once at drag start. Walk descendants so
      // container drags can preview every displaced child — required by
      // `usePreviewGhostLayer.buildSubtree` which only recurses into ids
      // present in `previewIds()`.
      const startPoses = new Map<NodeId, unknown>();
      const cascadeIds: NodeId[] = [];
      const seen = new Set<NodeId>();
      const queue: NodeId[] = [];
      for (const id of ids) {
        const node = scene.get(id);
        if (!node) continue;
        startPoses.set(id, node.pose);
        seen.add(id);
        queue.push(id);
      }
      while (queue.length > 0) {
        const parent = queue.shift()!;
        for (const childId of scene.childrenOf(parent)) {
          if (seen.has(childId)) continue;
          seen.add(childId);
          const childNode = scene.get(childId);
          if (!childNode) continue;
          startPoses.set(childId, childNode.pose);
          cascadeIds.push(childId);
          queue.push(childId);
        }
      }

      const scratch: MoveScratch = {
        startPoses,
        ids,
        cascadeIds,
        scene,
        currentDelta: { dx: 0, dy: 0 },
        previews: new Map<NodeId, unknown>(),
      };

      return {
        onMove(moveCtx: InvocationCtx): void {
          if (!moveCtx.drag) return;
          // Track delta in scratch only — no scene writes, no history entries.
          scratch.currentDelta = {
            dx: moveCtx.drag.delta.x,
            dy: moveCtx.drag.delta.y,
          };
          // Refresh preview poses for every displaced id (roots + cascade).
          // The preview-ghost layer reads these via `previewIds`/`previewPose`.
          const { dx, dy } = scratch.currentDelta;
          scratch.previews.clear();
          for (const [id, origin] of scratch.startPoses) {
            scratch.previews.set(id, translatePoseGeneric(origin, dx, dy));
          }
        },
        onEnd(_endCtx: InvocationCtx, reason: 'commit' | 'cancel'): void {
          if (reason === 'cancel') {
            // Scene was never mutated during drag; nothing to restore.
            scratch.previews.clear();
            return;
          }
          // 'commit': apply final delta as a single batch → one undo entry.
          const { dx, dy } = scratch.currentDelta;
          // No-op if no movement (sub-threshold drag or zero delta).
          if (dx === 0 && dy === 0) {
            scratch.previews.clear();
            return;
          }
          scratch.scene.batch('Move', () => {
            // Only write the selected roots — descendants follow implicitly
            // under local-pose semantics. Children are previewed but their
            // local poses are unchanged at commit.
            for (const id of scratch.ids) {
              const origin = scratch.startPoses.get(id);
              if (origin === undefined) continue;
              scratch.scene.setPose(id, translatePoseGeneric(origin, dx, dy));
            }
          });
          scratch.previews.clear();
        },
        previewIds: () => scratch.previews.keys(),
        previewPose: (id: string) => scratch.previews.get(id as NodeId) ?? null,
      };
    },
  },
  /**
   * Always enabled at the descriptor level. The dispatcher's
   * specificity-fallthrough loop (`dispatcher.ts`) treats anything
   * `!== true` from `enabled()` as "this match is disabled — fall through
   * to the next-best one." Returning `ActionDisabledReason.SelectionRequired`
   * here caused every drag-on-selected-body to silently lose to lower
   * specificity ambient bindings (notably `insertAction`'s bare drag),
   * inserting phantom rects on every move attempt. The invoker self-guards
   * on empty selection by returning `{}`, so a static `true` is correct
   * for the dispatcher gate; the command-palette enabled signal will need
   * a deps-aware predicate when that surface is wired up.
   *
   * Phase 7 TODO (still standing): extend `Action.enabled` to accept a
   * deps snapshot so command-palette enabled state can be selection-aware
   * without breaking dispatcher routing.
   */
  enabled: () => true,
};
