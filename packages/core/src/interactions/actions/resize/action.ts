/**
 * `resizeAction` — ongoing Action descriptor for anchor-relative drag resize.
 *
 * ## Status: REAL
 *
 * Performs real anchor-relative resize math for rect-shaped poses. Reads
 * `ctx.drag.affordance.anchor` to determine which corner is fixed, captures
 * start poses, applies per-frame bounds remapping, and commits one batch on
 * end — labeled, transient and observed per the `resizePolicy` dep's
 * lifecycle fields.
 *
 * ## Behaviors / point-snap / expandIds — via the `resizePolicy` dep
 *
 * The `resizePolicy` dep carries the behavior options (`constraints`,
 * `pointSnap`, `expandIds`). When the dep
 * is registered, this invoker:
 *
 *  - Calls `expandIds([id])` at start. When the result expands beyond the
 *    starting id, takes the group path (union-AABB origin, per-leaf remap).
 *  - Runs `constraints[]` after the raw anchor-math bounds are computed.
 *    Constraints return `{ pose? }` and rewrite the proposed bounds before
 *    they're projected back into pose space.
 *  - Runs `pointSnap[]` after the bounds→pose projection. The first non-null
 *    `PointSnapResult` wins; this invoker back-solves a pose so the chosen
 *    frame's world point lands on the snap target.
 *
 * When the dep is absent the invoker falls back to defaults
 * (the kit's default constraints, no snap, `ids => ids` expansion).
 *
 * ## Pose geometry — via the `poseDescriptor` dep
 *
 * Every pose read and rewrite goes through the `poseDescriptor` dep, which
 * `<SceneCanvas>` sources from its `poseDescriptor` prop. Unsourced it is
 * `AUTO_POSE_DESCRIPTOR`, which dispatches per call to `pathPoseDescriptor`
 * for Path-shaped poses and to `RECT_POSE_DESCRIPTOR` for everything else.
 *
 * @see src/interactions/actions/resize/geometry.ts — `PoseDescriptor`.
 */

import type { Action } from '@weasel-js/routing';
import type { InvocationCtx, OngoingHandle } from '@weasel-js/routing';
import type { NodeId } from 'core/scene/types';
import { closeGesture, runBehaviorCancel } from '../gestureLifecycle';
import { inPlane, selectionLayer } from '../planeInput';
import { commitResize } from './commit';
import { nextFrame } from './frame';
import { beginResize, type ResizeFrame } from './session';

/**
 * @experimental
 * Static descriptor for the `resize` Action.
 *
 * Requires dep-schema entries: `selection`, `scene`.
 * Reads optional `resizePolicy` dep when present.
 * Requires `InvocationCtx.drag.affordance` with a `handle:*` kind.
 */
export const resizeAction: Action & { requires: string[] } = inPlane({
  id: 'resize',
  label: 'Resize',
  // No default binding: a bare `{ kind: 'drag' }` claimed every drag at ambient
  // scope, tying areaSelect's. The resize handles bind it
  // (`selectionResizeBindings`, the `resize` preset).
  eligible: { capability: 'transforms-selection' },
  requires: ['selection', 'scene', 'resizePolicy', 'poseDescriptor', 'applyOps', 'geometryProjection', 'view'],
  invoker: {
    timing: 'ongoing',
    start(ctx: InvocationCtx, _opts): OngoingHandle {
      const begun = beginResize(ctx);
      if (!begun) return {};
      const { session, readers } = begun;
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
            if (reason === 'commit') committed = commitResize(session, frame);
            else runBehaviorCancel(session.constraints, session.gestureCtx);
          } finally {
            closeGesture({ hold, previews: frame.previews, behaviors: session.constraints, ctx: session.gestureCtx, lifecycle: session.lifecycle }, committed);
          }
        },
        previewIds: () => frame.previews.keys(),
        previewPose: (id: string) => frame.previews.get(id as NodeId) ?? null,
      };
    },
  },
  /**
   * Always enabled at the descriptor level. The dispatcher's
   * specificity-fallthrough loop treats anything `!== true` as "skip and
   * try the next match" — returning `ActionDisabledReason.SelectionRequired`
   * here makes the resize binding silently lose to lower-specificity
   * matches (e.g. ambient `insertAction`), inserting phantom nodes on
   * every drag instead of resizing. The invoker self-guards on empty
   * selection (returns `{}`), so a static `true` here is correct.
   *
   * Fix: previously `() => ActionDisabledReason.SelectionRequired`
   * — that broke every dispatcher-routed resize. See git blame.
   */
  enabled: () => true,
}, selectionLayer);
