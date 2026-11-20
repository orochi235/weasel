import type { Op, NodeId } from '@weasel-js/core';
import { translateNodeOps } from '@weasel-js/core';
import { holderOf } from '@weasel-js/select';
import { localDelta, storedLeadFor } from './delta';
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
      if (l === null) return c ?? null;
      if (c) return { dx: l.dx + c.dx, dy: l.dy + c.dy };
      const lead = storedLeadFor(session, id, delta.dx, delta.dy);
      return lead ? { ...l, lead } : l;
    },
    session.descriptorOf,
    session.geometryProjection,
    session.lifecycle.label,
  );
}

/** The default translate commit for the dragged roots among `roots` and the
 *  descendants that follow them, dragged ones included. Anything else in `roots` is ignored. */
export function rootTranslateOps(session: MoveSession, roots: Iterable<string>, delta: { dx: number; dy: number }): Op[] {
  const wanted = new Set<string>(roots);
  const parentOf = (id: string): string | null => session.scene.get(id as NodeId)?.parent ?? null;
  const others = new Set<NodeId>(session.ids.filter((id) => holderOf(wanted, id, parentOf) === null));
  return translateOps(session, unreleasedIds(session, others), delta);
}

/** Selected roots no source layout claimed on release, plus the descendants
 *  that follow them — the part of the selection the translate commit owns. */
export function unreleasedIds(session: MoveSession, released: Set<NodeId>): NodeId[] {
  const selected = new Set<NodeId>(session.ids);
  /** Whether a released root holds `id`, through no selected id that was not released. */
  const claimed = (id: NodeId): boolean => {
    for (let cur = session.scene.get(id)?.parent ?? null; cur; cur = session.scene.get(cur)?.parent ?? null) {
      if (released.has(cur)) return true;
      if (selected.has(cur)) return false;
    }
    return false;
  };
  return [...session.ids.filter((id) => !released.has(id)), ...session.cascadeIds].filter((id) => !claimed(id));
}
