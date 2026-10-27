import type { InvocationCtx } from '@weasel-js/routing';
import { pointerStateOf } from '../pointerState';
import type { NodeId } from 'core/scene/types';
import { snapMods } from 'domains/snap/roles';
import type { GestureReaders } from '../../gestures/shared/screenTolerance';
import type { GestureContext, RotateBehavior, RotateProposed } from '../../gestures/types';
import { carryPose, planeOf } from '../planeInput';
import { translatePoseViaDescriptor, type PoseDescriptor } from '../resize/geometry';
import type { RotateFrame, RotateSession, Turn, TurnOrigin } from './session';

/** `origin` turned by `delta` radians, its center orbiting `pivot` when one
 *  is given. */
function turnPose(
  d: PoseDescriptor<unknown>,
  origin: TurnOrigin,
  delta: number,
  pivot: { x: number; y: number } | null,
): unknown {
  const rotated = d.withRotation!(origin.world, origin.rotation + delta);
  if (!pivot) return rotated;
  const cos = Math.cos(delta);
  const sin = Math.sin(delta);
  const ox = origin.center.x - pivot.x;
  const oy = origin.center.y - pivot.y;
  const nx = pivot.x + ox * cos - oy * sin;
  const ny = pivot.y + ox * sin + oy * cos;
  return translatePoseViaDescriptor(rotated, nx - origin.center.x, ny - origin.center.y, d);
}

/** Each rotated node's world pose turned by `delta`. */
export function turnedWorlds(turn: Turn, delta: number): Map<NodeId, unknown> {
  const out = new Map<NodeId, unknown>();
  const pivot = turn.useUnionPivot ? turn.pivot : null;
  for (const [id, origin] of turn.origins) {
    out.set(id, turnPose(turn.descriptorOf(id), origin, delta, pivot));
  }
  return out;
}

/** Write the poses a turn by `delta` gives into `gctx.current`. */
export function syncGestureCurrent(
  gctx: GestureContext<unknown>,
  turn: Turn,
  delta: number,
): Map<NodeId, unknown> {
  const turned = turnedWorlds(turn, delta);
  for (const [id, pose] of turned) gctx.current.set(id as string, pose);
  return turned;
}

/** The pointer's delta as the behaviors reshape it. */
function shapeDelta(
  turn: Turn,
  behaviors: readonly RotateBehavior<unknown>[],
  gctx: GestureContext<unknown>,
  readers: GestureReaders,
  moveCtx: InvocationCtx,
  raw: number,
): number {
  gctx.modifiers = { ...moveCtx.modifiers };
  gctx.pointer = pointerStateOf(moveCtx.world, moveCtx);
  gctx.view = readers.view();
  gctx.plane = readers.plane();
  const primary = turn.origins.keys().next().value as NodeId;
  const originRotation = turn.origins.get(primary)?.rotation ?? 0;
  let delta = raw;
  let proposed: RotateProposed<unknown> = {
    pose: syncGestureCurrent(gctx, turn, raw).get(primary),
    rotation: originRotation + raw,
  };
  for (const b of behaviors) {
    const r = b.onMove?.(gctx, proposed);
    if (!r) continue;
    if (r.rotation !== undefined) {
      delta = r.rotation - originRotation;
      proposed = { pose: syncGestureCurrent(gctx, turn, delta).get(primary), rotation: r.rotation };
      continue;
    }
    if (r.pose === undefined) continue;
    const rotation = turn.descriptorOf(primary).getRotation?.(r.pose) ?? 0;
    delta = rotation - originRotation;
    proposed = { pose: r.pose, rotation };
  }
  return delta;
}

/** Every rotated id's stored pose under a turn by `delta`; none at zero. */
export function storedPreviews(
  session: Pick<RotateSession, 'scene' | 'turn' | 'poseFrame' | 'view'>,
  delta: number,
): Map<NodeId, unknown> {
  const previews = new Map<NodeId, unknown>();
  if (delta === 0) return previews;
  for (const [id, turned] of turnedWorlds(session.turn, delta)) {
    const layer = session.scene.get(id)?.layer;
    const own = layer === undefined ? null : planeOf(session.view, layer);
    previews.set(id, session.poseFrame.local(id, carryPose(session.turn.descriptorOf(id), turned, own)));
  }
  return previews;
}

/** One move's delta and previews: the pointer's angle since press as the
 *  snap session and then the behaviors shaped it, and every rotated id's stored pose under it. */
export function nextFrame(session: RotateSession, readers: GestureReaders, moveCtx: InvocationCtx): RotateFrame {
  const { pivot } = session.turn;
  const pointerAngle = Math.atan2(moveCtx.world.y - pivot.y, moveCtx.world.x - pivot.x);
  const raw = pointerAngle - session.startPointerAngle;
  const snapped = session.snap.angle(session.theta0 + raw, snapMods(moveCtx)).theta - session.theta0;
  const delta = session.behaviors.length > 0
    ? shapeDelta(session.turn, session.behaviors, session.gestureCtx, readers, moveCtx, snapped)
    : snapped;
  return { delta, previews: storedPreviews(session, delta) };
}
