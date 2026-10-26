import type { Op } from 'core/ops/types';
import type { NodeId } from 'core/scene/types';
import { translateNodeOps } from '../moveNodes';
import { localDelta } from './delta';
import type { MoveSession } from './session';

/** The default translate commit: one transform op per id, plus the data-held
 *  geometry op when the `geometryProjection` seam is wired. */
export function translateOps(session: MoveSession, ids: Iterable<NodeId>, delta: { dx: number; dy: number }): Op[] {
  return translateNodeOps(
    session.scene,
    ids,
    (id) => {
      if (!session.startPoses.has(id)) return null;
      const c = session.caught.get(id);
      // A moving frame carries the drag; a catch mid-glide is the node's own.
      if (session.carried.has(id)) return c ?? null;
      const l = localDelta(session, id, delta.dx, delta.dy);
      return c ? { dx: l.dx + c.dx, dy: l.dy + c.dy } : l;
    },
    session.descriptorOf,
    session.geometryProjection,
    session.lifecycle.label,
  );
}

/** The default translate commit for the dragged roots among `roots` and the
 *  descendants that follow them. Anything else in `roots` is ignored. */
export function rootTranslateOps(session: MoveSession, roots: Iterable<string>, delta: { dx: number; dy: number }): Op[] {
  const wanted = new Set<string>(roots);
  const others = new Set<NodeId>(session.ids.filter((id) => !wanted.has(id)));
  return translateOps(session, unreleasedIds(session, others), delta);
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
