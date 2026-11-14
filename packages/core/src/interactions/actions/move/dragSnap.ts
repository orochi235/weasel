import type { InvocationCtx, WorldPoint } from '@weasel-js/routing';
import type { SnapSession } from '../snapDep';
import { lazySnapSession } from 'domains/snap/lazySession';
import { snapMods } from 'domains/snap/roles';

/** A translate drag's snapping: a move's, or a clone's. */
export interface DragSnap {
  /** Begun once the drag passes its threshold; null with no `snap` dep. */
  readonly snap: SnapSession | null;
  /** The press, in the coordinates the drag's delta is measured in. */
  readonly press: WorldPoint;
}

/** The snapping of a drag that translates `ids`, which offer no targets unless `exclude` names others. */
export function beginDragSnap(ctx: InvocationCtx, ids: readonly string[], exclude?: readonly string[]): DragSnap {
  const press = ctx.drag?.start ?? ctx.world;
  return {
    snap: lazySnapSession(ctx.deps.snap, { gesture: 'move', ids, press, constrain: 'axis', ...(exclude ? { exclude } : {}) }),
    press,
  };
}

interface Landed {
  readonly dx: number;
  readonly dy: number;
  readonly landing: unknown;
}

/** Each session's latest landing, with the delta it was reported for. */
const landings = new WeakMap<SnapSession, Landed>();

/** The pointer's delta, moved so the subject lands on what the snap session
 *  holds it to. */
export function snappedDelta(drag: DragSnap, moveCtx: InvocationCtx): { dx: number; dy: number } {
  const d = moveCtx.drag!.delta;
  if (!drag.snap) return { dx: d.x, dy: d.y };
  const { press } = drag;
  const out = drag.snap.at({ x: press.x + d.x, y: press.y + d.y }, snapMods(moveCtx));
  const dx = out.point.x - press.x;
  const dy = out.point.y - press.y;
  if (out.landing === undefined) landings.delete(drag.snap);
  else landings.set(drag.snap, { dx, dy, landing: out.landing });
  return { dx, dy };
}

/** The host's landing (`SnapOutcome.landing`) for the drag `(dx, dy)`, when
 *  that is the delta the session last snapped to; otherwise undefined. */
export function snapLanding(drag: DragSnap, dx: number, dy: number): unknown {
  const last = drag.snap ? landings.get(drag.snap) : undefined;
  return last && last.dx === dx && last.dy === dy ? last.landing : undefined;
}
