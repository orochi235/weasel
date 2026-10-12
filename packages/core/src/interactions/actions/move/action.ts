/**
 * `moveAction` — first `ongoing`-timing Action descriptor.
 *
 * A per-frame translate of the selection:
 *   - `start`: capture origin poses for all selected nodes.
 *   - `onMove`: publish the frame's poses as ephemeral overrides. No
 *     *document* writes, so the undo stack still sees one entry for the whole
 *     drag.
 *   - `onEnd('commit')`: emit the final delta as transform ops and commit
 *     them as one batch (`commitGestureOps`) → at most one undo entry for the
 *     whole drag, none when the binding's params make it transient.
 *   - `onEnd('cancel')`: drop the overrides — the document was never mutated,
 *     so the committed poses are the restoration.
 *
 * ## Why no per-frame document writes
 *
 * `Scene.setPose` calls `executeAndLog`, which immediately records an undo
 * entry on the scene's history engine. Per-frame writes during drag would
 * create O(frames) history entries, so the drag commits one
 * `createTransformOp` batch at the end.
 *
 * The per-frame poses still go *somewhere* the scene can see: the ephemeral
 * override table, which bypasses history entirely. That is what lets a node
 * deriving its geometry from a dragged one follow the drag — `sceneDepLookup`
 * and the pick source both read overrides, and neither can see this action's
 * own state. Keeping the frame there alone is why the edge used to stay
 * anchored to the old endpoint and jump on drop.
 *
 * The behavior pipeline (snap-to-grid, snap-back-or-delete, snap-to-container,
 * etc.) via `opts.behaviors` from `BindingOpts` IS wired: `start` builds a
 * `GestureContext` + scene-backed adapter (`moveGestureAdapter`), `onMove`
 * folds each behavior's proposed-transform result, and `onEnd` runs a
 * first-non-undefined-wins reducer (`Op[]` commits via `commitGestureOps`,
 * `null` aborts, all-`undefined` falls through to the default translate path).
 * `beginMove` appends the action's own two to the binding's: a layout drop and
 * reparent-on-drop (`./behaviors/`).
 *
 * ## Pose generics
 *
 * Poses are `unknown`; every read and write goes through the `poseDescriptor`
 * dep (`AUTO_POSE_DESCRIPTOR` when unsourced).
 */

import type { Action } from '@weasel-js/routing';
import type { InvocationCtx, OngoingHandle, BindingOpts } from '@weasel-js/routing';
import { pastDragThreshold } from '@weasel-js/routing';
import type { NodeId } from 'core/scene/types';
import { closeGesture, runBehaviorCancel } from '../gestureLifecycle';
import { inPlane, selectionLayer } from '../planeInput';
import { beginMove, type MoveFrame, type ReparentOnDrop } from './session';
import { nextFrame } from './frame';
import { commitMove } from './commit';
export type { ReparentOnDrop };

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
 */
export const moveAction: Action & { requires: string[] } = inPlane({
  id: 'move',
  label: 'Move',
  // No hover `cursor`: pointing at a node shouldn't preemptively promise a
  // move, matching what `useSelectTool` showed before its scratch-driven
  // cursor was retired. Once the drag is running, it's a move.
  activeCursor: 'move',
  // Ambient default targets `selected-body` so a host without an explicit
  // select-tool binding still gets drag-to-move on the selection — but ONLY
  // on the selected body. A bare `{ kind: 'drag' }` catches every drag in
  // ambient scope and bleeds the move into drawing-tool gestures (any path
  // where the higher-priority active match falls through). Drawing tools
  // bind bare drag at active scope and outrank this; the symptom of
  // "drawing tools move the selection" disappears once the ambient binding
  // is target-qualified instead of universal.
  defaultBinding: { kind: 'drag', target: 'selected-body' },
  eligible: { capability: 'transforms-selection' },
  requires: ['selection', 'scene', 'poseDescriptor', 'layout', 'applyOps', 'geometryProjection', 'nodeAtPoint', 'view'],
  invoker: {
    timing: 'ongoing',
    start(ctx: InvocationCtx, opts?: BindingOpts): OngoingHandle {
      let frame: MoveFrame = { delta: { dx: 0, dy: 0 }, previews: new Map(), opaque: new Set() };
      const begun = beginMove(ctx, opts, () => frame);
      if (!begun) return {};
      const { session, readers } = begun;
      const hold = session.scene.overrides.hold();
      // Where the last move put the pointer, once the drag has passed its
      // threshold; null until then.
      let engaged: { x: number; y: number } | null = null;
      return {
        kind: 'move',
        onMove(moveCtx: InvocationCtx): void {
          if (!moveCtx.drag) return;
          if (!engaged) {
            const s = moveCtx.drag.screenDelta;
            if (s && !pastDragThreshold({ clientX: 0, clientY: 0 }, { clientX: s.x, clientY: s.y }, session.dragThresholdPx)) return;
            session.lifecycle.start(session.ids as unknown as string[]);
          }
          engaged = moveCtx.world;
          frame = nextFrame(session, readers, moveCtx);
          hold.set(frame.previews);
        },
        onEnd(endCtx: InvocationCtx, reason: 'commit' | 'cancel'): void {
          let committed = false;
          try {
            // On cancel the document was never mutated — dropping the
            // ephemeral overrides below restores the committed poses.
            // A press that never traveled `dragThresholdPx` was never a move:
            // its behaviors started, so they are canceled, not asked to commit.
            if (reason === 'commit' && engaged) {
              committed = commitMove({
                session,
                delta: frame.delta,
                at: endCtx.drag ? endCtx.world : engaged,
              });
            } else runBehaviorCancel(session.behaviors, session.gestureCtx);
          } finally {
            // After the commit, so no frame can paint the pre-drag pose between
            // the override going away and the document catching up.
            closeGesture({ hold, previews: frame.previews, behaviors: session.behaviors, ctx: session.gestureCtx, lifecycle: session.lifecycle }, committed);
          }
        },
        previewIds: () => frame.previews.keys(),
        previewPose: (id: string) => frame.previews.get(id as NodeId) ?? null,
        previewOpaqueIds: () => (frame.opaque.size === 0 ? null : frame.opaque),
      };
    },
  },
  /**
   * Always enabled at the descriptor level. The dispatcher's
   * specificity-fallthrough loop (`dispatcher.ts`) treats anything
   * `!== true` from `enabled()` as "this match is disabled — fall through
   * to the next-best one." Returning `ActionDisabledReason.SelectionRequired`
   * here caused every drag-on-selected-body to silently lose to lower
   * specificity bindings (a shape tool's insert drag, inserting phantom
   * rects on every move attempt). The invoker self-guards
   * on empty selection by returning `{}`, so a static `true` is correct
   * for the dispatcher gate; the command-palette enabled signal will need
   * a deps-aware predicate when that surface is wired up.
   *
   * Phase 7 TODO (still standing): extend `Action.enabled` to accept a
   * deps snapshot so command-palette enabled state can be selection-aware
   * without breaking dispatcher routing.
   */
  enabled: () => true,
}, selectionLayer);
