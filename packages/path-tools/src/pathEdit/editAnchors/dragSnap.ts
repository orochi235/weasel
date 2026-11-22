import type { WorldPoint } from '@weasel-js/routing';
import type { SnapBegin, SnapDep, SnapMods, SnapSession } from '@weasel-js/core';
import { createBareSnapSession } from '@weasel-js/core';
import { pathAwayFromAnchors, type PolygonPath } from '@weasel-js/geom';

/**
 * An anchor drag's snap: a `point` session, begun on the first move, for
 * where the pressed anchor goes. The edited path offers no targets but what
 * the drag leaves still of it (all but `moving`), and Shift holds the anchor
 * to the axes and diagonals through its press.
 */
export function anchorDragSnap(
  snap: SnapDep | undefined,
  press: { id: string; origin: WorldPoint; originPose: PolygonPath; moving: () => Iterable<number> },
): { at(world: WorldPoint, mods: SnapMods): WorldPoint; end(): void } {
  let session: SnapSession | null = null;
  return {
    at(world, mods) {
      if (!session) {
        const { path, anchors } = pathAwayFromAnchors(press.originPose, press.moving());
        const req: SnapBegin = {
          gesture: 'point', press: press.origin, ids: [press.id],
          also: { paths: [path], anchors }, constrain: 'axis',
        };
        session = snap?.begin(req) ?? createBareSnapSession(req);
      }
      return session.at(world, mods).point;
    },
    end() {
      session?.end();
      session = null;
    },
  };
}
