import type { SnapDep } from '../snapDep';

type Point = { x: number; y: number };

/** A move's path snapping: the base point it carries, and what it skips. */
export interface MovePathSnap {
  /** The press, moved onto a target of the dragged geometry's own when one
   *  is in range — the point of the dragged shape that locks to targets. */
  readonly base: Point;
  readonly snap: SnapDep & { toPaths: NonNullable<SnapDep['toPaths']> };
  /** Everything the drag moves, which offers no targets while it moves. */
  readonly exclude: readonly string[];
}

/** The base point of a move of `moved` pressed at `press`, or null when
 *  `snap` snaps to no paths. */
export function captureMovePathSnap(
  snap: SnapDep | undefined,
  press: Point,
  moved: readonly string[],
): MovePathSnap | null {
  if (!snap?.toPaths) return null;
  const base = snap.toPaths(press, { include: moved }) ?? { x: press.x, y: press.y };
  return { base, snap: snap as MovePathSnap['snap'], exclude: moved };
}

/** The pointer's delta, changed so the base point lands on a path target of
 *  the geometry the drag is not moving when one is in range. */
export function snapMoveDelta(s: MovePathSnap | null, dx: number, dy: number): { dx: number; dy: number } {
  if (!s) return { dx, dy };
  const hit = s.snap.toPaths({ x: s.base.x + dx, y: s.base.y + dy }, { origin: s.base, exclude: s.exclude });
  return hit ? { dx: hit.x - s.base.x, dy: hit.y - s.base.y } : { dx, dy };
}
