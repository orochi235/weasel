import type { Action } from '@weasel-js/routing';
import type { InvocationCtx, OngoingHandle } from '@weasel-js/routing';
import { transformPreviewFields } from '../transformFinish';
import { closeGesture, runBehaviorCancel } from '../gestureLifecycle';
import { inPlane, selectionLayer } from '../planeInput';
import { commitResize } from './commit';
import { nextFrame } from './frame';
import { beginResize, type ResizeFrame } from './session';
import { unitsOfBox } from './replay';
import { recordTransform } from '../transform-again/memory';
import { SNAP_ROLES } from 'features/snap/roles';

/**
 * Anchor-relative drag resize, committed as one batch on release. It needs
 * `InvocationCtx.drag.affordance` with a `handle:*` kind.
 *
 * The dragged corner or edge snaps through the `snap` dep's session before
 * the box is resized, held to the handle's axis, and to the box's diagonal
 * while `snap.constrain` (Shift) is held. The optional `resizePolicy` dep
 * carries the constraints, point snaps, and `expandIds`; absent, the invoker
 * runs no constraints and `ids => ids` expansion.
 */
export const resizeAction: Action & { requires: string[] } = inPlane({
  id: 'resize',
  label: 'Resize',
  // No default binding: a bare `{ kind: 'drag' }` claims every drag at ambient
  // scope. The resize handles bind it (`selectionResizeBindings`).
  eligible: { capability: 'transforms-selection' },
  modifierRoles: SNAP_ROLES,
  requires: [
    'selection', 'scene', 'resizePolicy', 'poseDescriptor', 'applyOps', 'geometryProjection', 'view',
    'boundsIncludeStroke', 'kitSettings', 'snap', 'editAnchors',
  ],
  invoker: {
    timing: 'ongoing',
    start(ctx: InvocationCtx, _opts): OngoingHandle {
      const begun = beginResize(ctx);
      if (!begun) return {};
      const { session, readers } = begun;
      const subject = [...(ctx.deps.selection?.get() ?? [])] as string[];
      const hold = session.scene.overrides.hold();
      let frame: ResizeFrame = { previews: new Map() };
      session.lifecycle.start(session.writeIds as readonly string[]);
      return {
        kind: 'resize',
        onMove(moveCtx: InvocationCtx): void {
          if (!moveCtx.drag) return;
          frame = nextFrame(session, readers, moveCtx);
          hold.set(frame.previews);
        },
        onEnd(_endCtx: InvocationCtx, reason: 'commit' | 'cancel'): void {
          let committed = false;
          try {
            if (reason === 'commit') {
              committed = commitResize(session, frame);
              if (committed && frame.proposed) {
                const to = unitsOfBox(session.box.bounds, frame.proposed);
                recordTransform(session.scene, { kind: 'scale', to, anchor: session.box.anchor }, subject);
              }
            } else runBehaviorCancel(session.constraints, session.gestureCtx);
          } finally {
            session.snap.end();
            closeGesture({ hold, previews: frame.previews, behaviors: session.constraints, ctx: session.gestureCtx, lifecycle: session.lifecycle }, committed);
          }
        },
        ...transformPreviewFields(ctx.deps, () => frame.previews),
      };
    },
  },
  /**
   * Always enabled: the dispatcher treats anything `!== true` as "skip and
   * try the next match", so a disabled reason here makes the resize binding
   * silently lose to lower-specificity matches (e.g. ambient `insertAction`).
   */
  enabled: () => true,
}, selectionLayer);
