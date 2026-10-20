import type { Action } from '@weasel-js/routing';
import type { BindingOpts, InvocationCtx, OngoingHandle } from '@weasel-js/routing';
import type { NodeId } from 'core/scene/types';
import { closeGesture, runBehaviorCancel } from '../gestureLifecycle';
import { inPlane, selectionLayer } from '../planeInput';
import { rotateCursorAt } from 'affordances/rotateCursor';
import { commitRotate } from './commit';
import { nextFrame } from './frame';
import { beginRotate, type RotateFrame } from './session';
import { recordTransform } from '../transform-again/memory';
import { SNAP_ROLES } from 'features/snap/roles';

/**
 * Pointer-driven rotation of the selection, committed as one undo entry.
 *
 * A pose whose descriptor has no `withRotation`, or reports
 * `supportsRotation` false, is left alone. The first rotated node's angle
 * snaps through the `snap` dep's session — quarter turns and other nodes'
 * angles, 15 degree steps while `snap.constrain` (Shift) is held — and the
 * rest of the selection turns by the same amount. Behaviors
 * (`opts.behaviors`) then see that node's turned pose; a pose one returns
 * from `onMove` sets the rotation for the whole selection.
 */
export const rotateAction: Action & { requires: string[] } = inPlane({
  id: 'rotate',
  label: 'Rotate',
  // No default binding: a bare `{ kind: 'drag' }` makes any drag no active
  // tool claimed rotate a non-empty selection. The rotation handle binds it
  // (`selectionRotateBindings`).
  eligible: { capability: 'transforms-selection' },
  modifierRoles: SNAP_ROLES,
  requires: ['selection', 'scene', 'applyOps', 'poseDescriptor', 'view', 'boundsIncludeStroke', 'kitSettings', 'snap', 'editAnchors'],
  invoker: {
    timing: 'ongoing',
    start(ctx: InvocationCtx, opts?: BindingOpts): OngoingHandle {
      const begun = beginRotate(ctx, opts);
      if (!begun) return {};
      const { session, readers } = begun;
      const subject = [...(ctx.deps.selection?.get() ?? [])] as string[];
      const hold = session.scene.overrides.hold();
      let frame: RotateFrame = { delta: 0, previews: new Map() };
      let pointer = ctx.world;
      session.lifecycle.start(session.gestureCtx.draggedIds);
      return {
        kind: 'rotate',
        cursor: () => {
          const scale = ctx.deps.view?.get().scale;
          return scale ? rotateCursorAt(session.turn.pivot, pointer, scale) : undefined;
        },
        onMove(moveCtx: InvocationCtx): void {
          pointer = moveCtx.world;
          frame = nextFrame(session, readers, moveCtx);
          hold.set(frame.previews);
        },
        onEnd(_endCtx: InvocationCtx, reason: 'commit' | 'cancel'): void {
          let committed = false;
          try {
            if (reason === 'commit') {
              committed = commitRotate(session, frame);
              if (committed) {
                const pivot = session.ids.length > 1 && !session.turn.useUnionPivot ? 'each' : 'union';
                recordTransform(session.scene, { kind: 'rotate', angle: frame.delta, pivot }, subject);
              }
            } else runBehaviorCancel(session.behaviors, session.gestureCtx);
          } finally {
            session.snap.end();
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
