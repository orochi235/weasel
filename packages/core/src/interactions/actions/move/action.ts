import type { Action } from '@weasel-js/routing';
import type { InvocationCtx, OngoingHandle, BindingOpts } from '@weasel-js/routing';
import { transformPreview } from '../transformFinish';
import { pastDragThreshold } from '@weasel-js/routing';
import { closeGesture, runBehaviorCancel } from '../gestureLifecycle';
import { inPlane, selectionLayer } from '../planeInput';
import { beginMove, type MoveFrame, type ReparentOnDrop } from './session';
import { nextFrame } from './frame';
import { commitMove } from './commit';
import { recordTransform } from '../transform-again/memory';
import { SNAP_ROLES } from 'features/snap/roles';
export type { ReparentOnDrop };

/**
 * Drag-translates the selection.
 *
 * Each frame's poses go to the scene's ephemeral override table, not the
 * document: `Scene.setPose` records an undo entry per call, and the overrides
 * are what let a node deriving its geometry from a dragged one follow the
 * drag. Release commits one batch — at most one undo entry, none when the
 * binding's params make it transient — and cancel drops the overrides.
 *
 * Behaviors from the binding's `opts.behaviors` fold into each frame; on
 * release the first non-`undefined` answer wins (`Op[]` commits, `null`
 * aborts). `beginMove` appends the action's own two: a layout drop and
 * reparent-on-drop.
 */
export const moveAction: Action & { requires: string[] } = inPlane({
  id: 'move',
  label: 'Move',
  // No hover `cursor`: pointing at a node shouldn't preemptively promise a move.
  activeCursor: 'move',
  // Ambient default targets `selected-body`, not a bare `{ kind: 'drag' }`,
  // which catches every drag in ambient scope and bleeds the move into
  // drawing-tool gestures wherever the higher-priority active match falls
  // through.
  defaultBinding: { kind: 'drag', target: 'selected-body' },
  eligible: { capability: 'transforms-selection' },
  modifierRoles: SNAP_ROLES,
  requires: ['selection', 'scene', 'poseDescriptor', 'layout', 'applyOps', 'geometryProjection', 'nodeAtPoint', 'canDropInto', 'view', 'boundsIncludeStroke', 'kitSettings', 'snap', 'transformFollowers'],
  invoker: {
    timing: 'ongoing',
    start(ctx: InvocationCtx, opts?: BindingOpts): OngoingHandle {
      let frame: MoveFrame = { delta: { dx: 0, dy: 0 }, previews: new Map(), opaque: new Set() };
      const begun = beginMove(ctx, opts, () => frame);
      if (!begun) return {};
      const { session, readers } = begun;
      const subject = [...(ctx.deps.selection?.get() ?? [])] as string[];
      const hold = session.scene.overrides.hold();
      const preview = transformPreview(ctx.deps, session.scene, () => frame.previews);
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
          hold.set(preview.poses());
        },
        onEnd(endCtx: InvocationCtx, reason: 'commit' | 'cancel'): void {
          let committed = false;
          try {
            // A press that never traveled `dragThresholdPx` was never a move:
            // its behaviors started, so they are canceled, not asked to commit.
            if (reason === 'commit' && engaged) {
              committed = commitMove({
                session,
                delta: frame.delta,
                at: endCtx.drag ? endCtx.world : engaged,
              });
              if (committed) recordTransform(session.scene, { kind: 'translate', ...frame.delta }, subject);
            } else runBehaviorCancel(session.behaviors, session.gestureCtx);
          } finally {
            session.snap?.end();
            // After the commit, so no frame can paint the pre-drag pose between
            // the override going away and the document catching up.
            closeGesture({ hold, previews: frame.previews, behaviors: session.behaviors, ctx: session.gestureCtx, lifecycle: session.lifecycle }, committed);
          }
        },
        previewIds: preview.previewIds,
        previewData: preview.previewData,
        previewOpaqueIds: () => (frame.opaque.size === 0 ? null : frame.opaque),
      };
    },
  },
  /**
   * Always enabled: the dispatcher treats anything `!== true` as "fall
   * through to the next-best match", so a disabled reason here loses every
   * drag-on-selected-body to a lower-specificity binding (a shape tool's
   * insert drag).
   */
  enabled: () => true,
}, selectionLayer);
