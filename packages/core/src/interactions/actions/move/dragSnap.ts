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

/** The pointer's delta, moved so the subject lands on what the snap session
 *  holds it to. */
export function snappedDelta(drag: DragSnap, moveCtx: InvocationCtx): { dx: number; dy: number } {
  const d = moveCtx.drag!.delta;
  if (!drag.snap) return { dx: d.x, dy: d.y };
  const { press } = drag;
  const out = drag.snap.at({ x: press.x + d.x, y: press.y + d.y }, snapMods(moveCtx));
  return { dx: out.point.x - press.x, dy: out.point.y - press.y };
}
