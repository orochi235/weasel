import type { Mat3 } from '@weasel-js/geom';
import { translatePoseViaDescriptor } from 'core/geometry/poseDescriptor';
import { createTransformOp } from 'core/ops/transform';
import type { Op } from 'core/ops/types';
import type { NodeId } from 'core/scene/types';
import { geometryDataOp } from '../geometryProjection';
import { localDelta } from './delta';
import type { MoveSession } from './session';

/** The default translate commit: one transform op per id, plus the data-held
 *  geometry op when the `geometryProjection` seam is wired. */
export function translateOps(session: MoveSession, ids: Iterable<NodeId>, delta: { dx: number; dy: number }): Op[] {
  const ops: Op[] = [];
  for (const id of ids) {
    if (!session.startPoses.has(id) || session.carried.has(id)) continue;
    const node = session.scene.get(id);
    if (!node) continue;
    const l = localDelta(session, id, delta.dx, delta.dy);
    const c = session.caught.get(id);
    if (c) { l.dx += c.dx; l.dy += c.dy; }
    const m: Mat3 = [1, 0, 0, 1, l.dx, l.dy];
    // The authored pose, not the captured one: a derived node's captured pose
    // is its derivation, and writing that back would lose the placeholder undo
    // restores.
    const authored = node.pose;
    ops.push(createTransformOp<unknown>({
      id: id as string,
      from: authored,
      to: translatePoseViaDescriptor(authored, l.dx, l.dy, session.descriptorOf(id)),
      label: session.lifecycle.label,
    }));
    if (session.geometryProjection) {
      const dataOp = geometryDataOp(
        session.geometryProjection,
        { id: id as string, data: node.data, pose: authored },
        m,
        session.lifecycle.label,
      );
      if (dataOp) ops.push(dataOp);
    }
  }
  return ops;
}

/** Selected roots no source layout claimed on release, plus the descendants
 *  that follow them — the part of the selection the translate commit owns. */
export function unreleasedIds(session: MoveSession, released: Set<NodeId>): NodeId[] {
  const selected = new Set<NodeId>(session.ids);
  const out: NodeId[] = session.ids.filter((id) => !released.has(id));
  for (const id of session.cascadeIds) {
    let cur = session.scene.get(id)?.parent ?? null;
    let claimed = false;
    while (cur) {
      if (released.has(cur)) { claimed = true; break; }
      if (selected.has(cur)) break;
      cur = session.scene.get(cur)?.parent ?? null;
    }
    if (!claimed) out.push(id);
  }
  return out;
}
