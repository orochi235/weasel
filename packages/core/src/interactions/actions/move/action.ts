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
import { syncPreviewOverrides, type PreviewOverrideState } from '../previewOverrides';
import { closeGesture, runBehaviorCancel } from '../gestureLifecycle';
import { inPlane, selectionLayer } from '../planeInput';
import { beginMove, type MoveFrame, type ReparentOnDrop } from './session';
import { runDropPass } from './layout/dropPass';
import { landReleased, releasedPoses, stepGlide } from './layout/glide';
import type { DropPass } from './layout/types';
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
  requires: ['selection', 'scene', 'poseDescriptor', 'layout', 'applyOps', 'poseComposition', 'geometryProjection', 'nodeAtPoint', 'view'],
  invoker: {
    timing: 'ongoing',
    start(ctx: InvocationCtx, opts?: BindingOpts): OngoingHandle {
      const begun = beginMove(ctx, opts);
      if (!begun) return {};
      const { session, readers } = begun;
      const publish: PreviewOverrideState = { scene: session.scene, previews: new Map(), overrideEntries: new Map() };
      const gliding = new Set<NodeId>();
      let frame: MoveFrame = { delta: { dx: 0, dy: 0 }, previews: publish.previews };
      let drop: DropPass | null = null;
      let lastWorld: { x: number; y: number } | null = null;
      let engaged = false;
      return {
        kind: 'move',
        onMove(moveCtx: InvocationCtx): void {
          if (!moveCtx.drag) return;
          lastWorld = moveCtx.world;
          if (!engaged) {
            const s = moveCtx.drag.screenDelta;
            if (s && !pastDragThreshold({ clientX: 0, clientY: 0 }, { clientX: s.x, clientY: s.y }, session.dragThresholdPx)) return;
            engaged = true;
            session.lifecycle.start(session.ids as unknown as string[]);
          }
          frame = nextFrame(session, readers, moveCtx);
          publish.previews = frame.previews;

          // Layout reflow pass — no-op without a layout dep.
          drop = null;
          drop = runDropPass(session, frame.delta, moveCtx.drag.current);
          const reflow = session.layout?.reflow;
          const targets = new Map<NodeId, unknown>();
          for (const [id, pose] of drop?.reflow ?? []) {
            if (reflow) targets.set(id, pose);
            else frame.previews.set(id, pose);
          }
          if (reflow) stepGlide(reflow, gliding, targets);

          // After the layout pass, so a reflowed sibling publishes too.
          syncPreviewOverrides(publish);
        },
        onEnd(endCtx: InvocationCtx, reason: 'commit' | 'cancel'): void {
          let committed = false;
          const reflow = session.layout?.reflow ?? null;
          const released = reflow ? releasedPoses(session, publish.previews) : null;
          try {
            // On cancel the document was never mutated — dropping the
            // ephemeral overrides below restores the committed poses.
            // A press that never traveled `dragThresholdPx` was never a move:
            // its behaviors started, so they are canceled, not asked to commit.
            if (reason === 'commit' && engaged) {
              committed = commitMove({
                session,
                delta: frame.delta,
                pass: drop?.pass ?? null,
                dropCenter: drop?.dropCenter ?? null,
                at: endCtx.drag ? endCtx.world : lastWorld,
              });
            } else runBehaviorCancel(session.behaviors, session.gestureCtx);
          } finally {
            // After the commit, so no frame can paint the pre-drag pose between
            // the override going away and the document catching up.
            closeGesture({ publish, behaviors: session.behaviors, ctx: session.gestureCtx, lifecycle: session.lifecycle }, committed, () => {
              // Also after the commit: each glide settles onto the pose the
              // document now holds, or back home on a cancel — the dragged ids
              // from where they were let go.
              if (reflow && released) {
                for (const id of gliding) reflow.settle(id as string);
                landReleased(session, reflow, released);
              }
              gliding.clear();
            });
          }
        },
        previewIds: () => publish.previews.keys(),
        previewPose: (id: string) => publish.previews.get(id as NodeId) ?? null,
        previewOpaqueIds: () => drop?.pass?.reflowIds ?? null,
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
