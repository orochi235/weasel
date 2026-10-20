import type { InvocationCtx } from '@weasel-js/routing';
import { pointerStateOf } from '../pointerState';
import type { NodeId } from 'core/scene/types';
import type { GestureReaders } from '../../gestures/shared/screenTolerance';
import type { BehaviorResult, GroupTransform } from '../../gestures/types';
import { draggedStoredPose } from './delta';
import { snapMods } from 'features/snap/roles';
import type { MoveFrame, MoveSession } from './session';

function foldBehaviors(
  session: MoveSession,
  readers: GestureReaders,
  moveCtx: InvocationCtx,
  dx: number,
  dy: number,
): { dx: number; dy: number; posed: Map<NodeId, unknown>; opaque: Set<NodeId> } {
  const posed = new Map<NodeId, unknown>();
  const opaque = new Set<NodeId>();
  const gctx = session.gestureCtx;
  gctx.modifiers = { ...moveCtx.modifiers };
  gctx.pointer = pointerStateOf(moveCtx.drag!.current, moveCtx);
  gctx.view = readers.view();
  gctx.plane = readers.plane();
  // `current` is pre-populated from the raw cursor delta BEFORE
  // any behavior shapes `transform`. Unlike `onEnd`, it is NOT
  // refreshed after each behavior runs — so onMove behaviors
  // should derive position from `origin` + the `proposed`
  // GroupTransform arg, NOT from `ctx.current` (which reflects
  // the unmodified delta at this frame's start).
  for (const [id, ori] of session.startPoses) {
    gctx.current.set(id as string, draggedStoredPose(session, id, ori, dx, dy));
  }
  let transform: GroupTransform = { kind: 'translate', dx, dy };
  for (const b of session.behaviors) {
    const r: BehaviorResult<unknown> | void = b.onMove?.(gctx, transform);
    if (!r) continue;
    if (r.poses) for (const [id, pose] of r.poses) posed.set(id as NodeId, pose);
    if (r.opaque) for (const id of r.opaque) opaque.add(id as NodeId);
    if (r.transform) transform = r.transform;
    if (r.snap !== undefined) gctx.snap = r.snap;
  }
  return { dx: transform.dx, dy: transform.dy, posed, opaque };
}

/** The pointer's delta, moved so the subject lands on what the snap session
 *  holds it to. */
function snapDelta(session: MoveSession, moveCtx: InvocationCtx): { dx: number; dy: number } {
  const d = moveCtx.drag!.delta;
  if (!session.snap) return { dx: d.x, dy: d.y };
  const { press } = session;
  const out = session.snap.at({ x: press.x + d.x, y: press.y + d.y }, snapMods(moveCtx));
  return { dx: out.point.x - press.x, dy: out.point.y - press.y };
}

/** One move's delta and previews: the pointer's delta as the behaviors shaped
 *  it, every displaced id's stored pose under it, and whatever else the
 *  behaviors posed. */
export function nextFrame(session: MoveSession, readers: GestureReaders, moveCtx: InvocationCtx): MoveFrame {
  const snapped = snapDelta(session, moveCtx);
  const { dx, dy, posed, opaque } = foldBehaviors(session, readers, moveCtx, snapped.dx, snapped.dy);

  // The delta stays in the frame — no scene writes, no history entries.
  const delta = { dx, dy };
  // Refresh preview poses for every displaced id (roots + cascade).
  // The preview-ghost layer reads these via `previewIds`/`previewPose`.
  const previews = new Map<NodeId, unknown>();
  for (const [id, ori] of session.startPoses) {
    const dragged = draggedStoredPose(session, id, ori, dx, dy);
    previews.set(id, session.carried.has(id) ? dragged : posed.get(id) ?? dragged);
  }
  for (const [id, pose] of posed) if (!session.startPoses.has(id)) previews.set(id, pose);
  return { delta, previews, opaque };
}
