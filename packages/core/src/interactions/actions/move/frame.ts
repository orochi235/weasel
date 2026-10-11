import type { InvocationCtx } from '@weasel-js/routing';
import type { NodeId } from 'core/scene/types';
import type { BehaviorResult, GroupTransform } from '../../gestures/types';
import { translatePoseViaDescriptor } from '../resize/geometry';
import { localDelta, planeDelta } from './delta';
import type { MoveFrame, MoveReaders, MoveSession } from './session';

function foldBehaviors(
  session: MoveSession,
  readers: MoveReaders,
  moveCtx: InvocationCtx,
  dx0: number,
  dy0: number,
): { dx: number; dy: number; posed: Map<NodeId, unknown> } {
  let dx = dx0;
  let dy = dy0;

  const posed = new Map<NodeId, unknown>();
  if (session.behaviors.length > 0) {
    const gctx = session.gestureCtx;
    gctx.modifiers = { ...moveCtx.modifiers };
    gctx.pointer = { worldX: moveCtx.drag!.current.x, worldY: moveCtx.drag!.current.y, clientX: 0, clientY: 0 };
    gctx.view = readers.view();
    gctx.plane = readers.plane();
    // `current` is pre-populated from the raw cursor delta BEFORE
    // any behavior shapes `transform`. Unlike `onEnd`, it is NOT
    // refreshed after each behavior runs — so onMove behaviors
    // should derive position from `origin` + the `proposed`
    // GroupTransform arg, NOT from `ctx.current` (which reflects
    // the unmodified delta at this frame's start).
    for (const [id, ori] of session.startPoses) {
      const own = planeDelta(session, id, dx, dy);
      gctx.current.set(id as string, translatePoseViaDescriptor(ori, own.dx, own.dy, session.descriptorOf(id)));
    }
    let transform: GroupTransform = { kind: 'translate', dx, dy };
    const primary = session.ids[0] as NodeId | undefined;
    for (const b of session.behaviors) {
      const r: BehaviorResult<unknown> | void = b.onMove?.(gctx, transform);
      if (!r) continue;
      if (r.poses) for (const [id, pose] of r.poses) posed.set(id as NodeId, pose);
      if (r.transform && r.transform.kind === 'translate') {
        transform = r.transform;
      } else if (r.pose !== undefined && primary !== undefined) {
        const o = session.startPoses.get(primary);
        if (o !== undefined) {
          const from = session.projection.getBounds(o);
          const to = session.projection.getBounds(r.pose);
          transform = { kind: 'translate', dx: to.x - from.x, dy: to.y - from.y };
        }
      }
      if (r.snap !== undefined) gctx.snap = r.snap;
    }
    if (transform.kind === 'translate') { dx = transform.dx; dy = transform.dy; }
  }
  return { dx, dy, posed };
}

/** One move's delta and previews: the pointer's delta as the behaviors shaped
 *  it, and every displaced id's stored pose under it. */
export function nextFrame(session: MoveSession, readers: MoveReaders, moveCtx: InvocationCtx): MoveFrame {
  const { dx, dy, posed } = foldBehaviors(session, readers, moveCtx, moveCtx.drag!.delta.x, moveCtx.drag!.delta.y);

  // Track delta in scratch only — no scene writes, no history entries.
  const delta = { dx, dy };
  // Refresh preview poses for every displaced id (roots + cascade).
  // The preview-ghost layer reads these via `previewIds`/`previewPose`.
  const previews = new Map<NodeId, unknown>();
  for (const [id, ori] of session.startPoses) {
    if (session.carried.has(id)) {
      previews.set(id, ori);
      continue;
    }
    const l = localDelta(session, id, dx, dy);
    previews.set(id, posed.get(id) ?? translatePoseViaDescriptor(ori, l.dx, l.dy, session.descriptorOf(id)));
  }
  return { delta, previews };
}
