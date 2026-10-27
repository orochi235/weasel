import type { NodeId } from 'core/scene/types';
import { translatePoseViaDescriptor, type TranslateLead } from 'core/geometry/poseDescriptor';
import { toPlane } from 'core/viewport/parallax';
import { composeWorldPose, type PoseAdapter } from 'core/scene/composePose';
import { planeOf } from '../planeInput';
import type { MoveSession } from './session';

/**
 * The world drag `(dx, dy)` as a translation of `id`'s stored pose. A pose is
 * stored in its frame, so under a turned frame the two point different ways.
 */
export function localDelta(
  session: MoveSession,
  id: NodeId,
  dx0: number,
  dy0: number,
): { dx: number; dy: number } {
  const { dx, dy } = planeDelta(session, id, dx0, dy0);
  const f = session.frames.get(id);
  if (f === undefined) return { dx, dy };
  const { pc } = session;
  const d = session.descriptorOf(id);
  const from = d.getBounds(pc.decompose(f.frameWorld, f.world));
  const to = d.getBounds(
    pc.decompose(f.frameWorld, translatePoseViaDescriptor(f.world, dx, dy, d, leadFor(session, id, dx0, dy0))),
  );
  return { dx: to.x - from.x, dy: to.y - from.y };
}

interface MoveLead {
  readonly dx0: number;
  readonly dy0: number;
  /** The lead's own delta, as its layer's plane measures the drag. */
  readonly dx: number;
  readonly dy: number;
  readonly lead: TranslateLead<unknown> | null;
}

const leads = new WeakMap<MoveSession, MoveLead>();

/** The move's first root, at press and dragged by `(dx0, dy0)`, in world
 *  space. Kept for the last drag asked about, since every id asks per frame. */
function moveLead(session: MoveSession, dx0: number, dy0: number): MoveLead {
  const last = leads.get(session);
  if (last && last.dx0 === dx0 && last.dy0 === dy0) return last;
  const id = session.ids.find((r) =>
    session.startPoses.has(r) && !session.carried.has(r) && !session.caught.has(r));
  let next: MoveLead = { dx0, dy0, dx: dx0, dy: dy0, lead: null };
  if (id !== undefined) {
    const from = session.frames.get(id)?.world ?? session.startPoses.get(id);
    const { dx, dy } = planeDelta(session, id, dx0, dy0);
    next = { dx0, dy0, dx, dy, lead: { from, to: translatePoseViaDescriptor(from, dx, dy, session.descriptorOf(id)) } };
  }
  leads.set(session, next);
  return next;
}

/** The lead to translate `id`'s world pose with under the drag `(dx0, dy0)`:
 *  the move's first root, when `id` measures the drag as the same delta. */
function leadFor(session: MoveSession, id: NodeId, dx0: number, dy0: number): TranslateLead<unknown> | undefined {
  if (session.caught.has(id)) return undefined;
  const m = moveLead(session, dx0, dy0);
  if (!m.lead) return undefined;
  const own = planeDelta(session, id, dx0, dy0);
  return own.dx === m.dx && own.dy === m.dy ? m.lead : undefined;
}

/** The lead for translating `id`'s stored pose: only a pose stored in world
 *  space, since a lead is a world pose. */
export function storedLeadFor(session: MoveSession, id: NodeId, dx0: number, dy0: number): TranslateLead<unknown> | undefined {
  return session.frames.has(id) ? undefined : leadFor(session, id, dx0, dy0);
}

/** The pose `id` stores once dragged by `(dx, dy)` from `start`, its stored
 *  pose at press. Unmoved when its frame is what moves. */
export function draggedStoredPose(session: MoveSession, id: NodeId, start: unknown, dx: number, dy: number): unknown {
  if (session.carried.has(id)) return start;
  const l = localDelta(session, id, dx, dy);
  return translatePoseViaDescriptor(start, l.dx, l.dy, session.descriptorOf(id), storedLeadFor(session, id, dx, dy));
}

/** The drag `(dx, dy)`, measured in the edited plane, as the drag of `id` in
 *  the world its own layer stores it in. */
export function planeDelta(
  session: MoveSession,
  id: NodeId,
  dx: number,
  dy: number,
): { dx: number; dy: number } {
  const layer = session.scene.get(id)?.layer;
  const ref = layer === undefined ? undefined : session.planeRefs.get(layer);
  if (!ref) return { dx, dy };
  const out = planeOf(session.view, layer!);
  const at = { x: ref.edited.x + dx, y: ref.edited.y + dy };
  const p = out ? toPlane(out, at) : at;
  return { dx: p.x - ref.own.x, dy: p.y - ref.own.y };
}

/** `adapter`, except that an id caught mid-glide answers with the pose it was
 *  grabbed at — where the drag measures it from. */
export function grabbedPoseAdapter(
  session: MoveSession,
  adapter: PoseAdapter<unknown>,
): PoseAdapter<unknown> {
  if (session.caught.size === 0) return adapter;
  return {
    ...adapter,
    getPose: (id) => (session.caught.has(id as NodeId)
      ? session.startPoses.get(id as NodeId)
      : adapter.getPose(id)),
  };
}

/** The world pose `id` was dragged to: its pose at press composed up through
 *  `adapter`, moved by the drag as its own layer's plane measures it. */
export function draggedWorldPose(
  session: MoveSession,
  adapter: PoseAdapter<unknown>,
  id: NodeId,
  delta: { dx: number; dy: number },
): unknown {
  const start = composeWorldPose(adapter, id as string, session.pc.compose);
  const own = planeDelta(session, id, delta.dx, delta.dy);
  return translatePoseViaDescriptor(
    start, own.dx, own.dy, session.descriptorOf(id), leadFor(session, id, delta.dx, delta.dy),
  );
}
