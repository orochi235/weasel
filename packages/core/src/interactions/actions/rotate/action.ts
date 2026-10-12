/**
 * `rotateAction` — ongoing Action descriptor for pointer-driven rotation.
 *
 * The rotation math:
 *   - `start`: captures origin poses + AABB centers; computes start pointer
 *     angle around the union center of selected nodes.
 *   - `onMove`: derives pointer angle delta from start, applies to each node's
 *     origin rotation. In union-pivot mode (multi-selection) orbits each item's
 *     center around the union center.
 *   - `onEnd('commit')`: builds one `createTransformOp` per node (from =
 *     pre-mutation origin pose, to = rotated pose) and commits them as a
 *     single batch → one undo entry for the whole drag. Routes through the
 *     optional `applyOps` dep (consumer history) when present, else
 *     `scene.applyBatch` + `defaultCommitAdapter`.
 *   - `onEnd('cancel')`: no scene writes (scene never mutated during drag).
 *
 * ## Constraints
 *
 * - Reads and writes poses through the `poseDescriptor` dep; a pose whose
 *   descriptor has no `withRotation`, or reports `supportsRotation` false, is
 *   left alone.
 * - Behaviors (`opts.behaviors`) see the first rotated node's turned pose; a
 *   pose one returns from `onMove` sets the rotation for the whole selection.
 * - Shift-snap (15° quantum) is NOT wired in this phase — omitted deliberately
 *   to keep the invoker self-contained (would need to read shift from onMove ctx).
 *   TODO: thread shift from InvocationCtx.modifiers.shift into snap logic.
 */

import type { Action } from '@weasel-js/routing';
import type { BindingOpts, InvocationCtx, OngoingHandle } from '@weasel-js/routing';
import type { NodeId } from 'core/scene/types';
import { closeGesture, runBehaviorCancel } from '../gestureLifecycle';
import { inPlane, selectionLayer } from '../planeInput';
import { commitRotate } from './commit';
import { nextFrame } from './frame';
import { beginRotate, type RotateFrame } from './session';

/**
 * @experimental
 * Static descriptor for the `rotate` Action.
 *
 * Requires dep-schema entries: `selection`, `scene`.
 *
 */
export const rotateAction: Action & { requires: string[] } = inPlane({
  id: 'rotate',
  label: 'Rotate',
  // No default binding. It used to be a bare `{ kind: 'drag' }`, which made
  // any drag no active tool claimed rotate a non-empty selection. The rotation
  // handle binds it (`selectionRotateBindings`, the `rotate` preset).
  eligible: { capability: 'transforms-selection' },
  requires: ['selection', 'scene', 'applyOps', 'poseDescriptor', 'poseComposition', 'view'],
  invoker: {
    timing: 'ongoing',
    start(ctx: InvocationCtx, opts?: BindingOpts): OngoingHandle {
      const begun = beginRotate(ctx, opts);
      if (!begun) return {};
      const { session, readers } = begun;
      const hold = session.scene.overrides.hold();
      let frame: RotateFrame = { delta: 0, previews: new Map() };
      session.lifecycle.start(session.gestureCtx.draggedIds);
      return {
        kind: 'rotate',
        onMove(moveCtx: InvocationCtx): void {
          frame = nextFrame(session, readers, moveCtx);
          hold.set(frame.previews);
        },
        onEnd(_endCtx: InvocationCtx, reason: 'commit' | 'cancel'): void {
          let committed = false;
          try {
            if (reason === 'commit') committed = commitRotate(session, frame);
            else runBehaviorCancel(session.behaviors, session.gestureCtx);
          } finally {
            closeGesture({ hold, previews: frame.previews, behaviors: session.behaviors, ctx: session.gestureCtx, lifecycle: session.lifecycle }, committed);
          }
        },
        previewIds: () => frame.previews.keys(),
        previewPose: (id: string) => frame.previews.get(id as NodeId) ?? null,
      };
    },
  },
  enabled: () => true,
}, selectionLayer);
