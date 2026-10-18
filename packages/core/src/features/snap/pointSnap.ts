import type { SnapBegin, SnapDep, SnapMods, SnapOutcome, SnapSession } from 'interactions/actions/snapDep';
import { inputSession } from './session2d';

type Point = { x: number; y: number };

const FREE: SnapMods = { suspend: false, constrain: false };

/** A drawing tool's point snapping: the points it places one by one, and the
 *  cursor it trails from the last of them. */
export interface PointSnap {
  /** Where a point placed at `p` lands, in a `point` session of its own
   *  whose `origin` is the point placed before. */
  place(dep: SnapDep | undefined, p: Point, mods: SnapMods, origin?: Point): SnapOutcome;
  /** Where the cursor at `p` lands. One session runs while `dep` and
   *  `origin` stay the same, and its marks stay drawn until {@link stop}. */
  trail(dep: SnapDep | undefined, p: Point, origin?: Point): Point;
  /** End the cursor's session, clearing its marks. */
  stop(): void;
}

/** A {@link PointSnap}. With no `snap` dep, or one that runs no sessions,
 *  every point lands where it is. */
export function pointSnap(): PointSnap {
  let live: { session: SnapSession; dep: SnapDep | undefined; origin: Point | undefined } | null = null;
  const begin = (dep: SnapDep | undefined, req: SnapBegin) => dep?.begin(req) ?? inputSession(req);
  const request = (p: Point, origin: Point | undefined): SnapBegin => ({ gesture: 'point', press: p, ...(origin ? { origin } : {}) });
  const stop = () => {
    live?.session.end();
    live = null;
  };
  return {
    place(dep, p, mods, origin) {
      const session = begin(dep, request(p, origin));
      try {
        return session.at(p, mods);
      } finally {
        session.end();
      }
    },
    trail(dep, p, origin) {
      if (!live || live.dep !== dep || live.origin?.x !== origin?.x || live.origin?.y !== origin?.y) {
        stop();
        live = { session: begin(dep, request(p, origin)), dep, origin: origin && { ...origin } };
      }
      return live.session.at(p, FREE).point;
    },
    stop,
  };
}
