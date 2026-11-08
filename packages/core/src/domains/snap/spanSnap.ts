import type { SnapBegin, SnapConstrain, SnapDep, SnapMods, SnapOutcome, SnapSession } from 'interactions/actions/snapDep';
import { inputSession } from './session2d';
import type { Point } from '@weasel-js/geom';

/** A two-point gesture's snapping: a drawn line, a measurement, a box. */
export interface SpanSnap {
  /** Snap the start, pressed at `p`. The end then snaps about where it lands. */
  start(p: Point, mods: SnapMods): SnapOutcome;
  /** Move the start by `(dx, dy)` from where it was pressed or last carried
   *  to, unsnapped, and snap it there. */
  carry(dx: number, dy: number, mods: SnapMods): SnapOutcome;
  /** Snap the end. */
  end(p: Point, mods: SnapMods): SnapOutcome;
  /** Turn the end about `p`, a start placed by something other than this
   *  snap. */
  anchor(p: Point): void;
  /** Whether a target holds the start. */
  startHeld(): boolean;
  /** Clears the gesture's marks. */
  close(): void;
}

/**
 * A `point` session for each end of a span. The end's session has the
 * snapped start as its `origin`, so a `constrain` step turns about the start
 * as drawn. `constrain` is read whenever the end snaps, and a new value
 * reopens the end's session. With no `snap` dep, or one that runs no
 * sessions, only `constrain` applies. `common` goes into every session's
 * request.
 */
export function spanSnap(
  dep: SnapDep | undefined,
  constrain: () => SnapConstrain | undefined = () => undefined,
  common: Pick<SnapBegin, 'parent'> = {},
): SpanSnap {
  const begin = (req: SnapBegin): SnapSession => dep?.begin(req) ?? inputSession(req);
  let raw: Point = { x: 0, y: 0 };
  let start: Point = raw;
  let held = false;
  let live: { session: SnapSession; key: string } | null = null;
  // The start's own session, kept open so its marks stay drawn until the end
  // snaps: the end's session drops a point target on its origin, the start.
  let placed: SnapSession | null = null;

  const settle = (): void => {
    placed?.end();
    placed = null;
  };
  const open = (): SnapSession => {
    settle();
    const c = constrain();
    const key = JSON.stringify(c ?? null);
    if (live?.key === key) return live.session;
    live?.session.end();
    live = { session: begin({ ...common, gesture: 'point', press: start, origin: start, ...(c ? { constrain: c } : {}) }), key };
    return live.session;
  };
  const drop = (): void => {
    settle();
    live?.session.end();
    live = null;
  };
  const place = (p: Point, mods: SnapMods): SnapOutcome => {
    raw = p;
    drop();
    placed = begin({ ...common, gesture: 'point', press: p });
    const landed = placed.at(p, mods);
    start = landed.point;
    held = landed.held;
    return landed;
  };

  return {
    start: place,
    carry: (dx, dy, mods) => place({ x: raw.x + dx, y: raw.y + dy }, mods),
    end: (p, mods) => open().at(p, mods),
    anchor(p) {
      if (p.x === start.x && p.y === start.y) return;
      start = p;
      drop();
    },
    startHeld: () => held,
    close: drop,
  };
}
