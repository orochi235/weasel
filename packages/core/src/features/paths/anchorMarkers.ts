/**
 * The marker an anchor draws as in screen space, by what kind of point it is:
 * a square for an ordinary path anchor and a spiro corner, a circle for a
 * smooth spiro point, and a half-disc for a spiro point beside a straight
 * segment, its flat side toward the line and its round side toward the curve.
 * The path-edit overlay and the spiro tool's preview both draw from here.
 */
import { circlePath, polygonFromPoints, squarePath, type PolygonPath, type SpiroKind } from '@weasel-js/geom';

type Point = { x: number; y: number };

const HALF_DISC_STEPS = 12;

/** A half-disc of radius `r` centered on `(x, y)`, bulging toward `toward`. */
function halfDisc(x: number, y: number, r: number, toward: Point): PolygonPath {
  const mid = Math.atan2(toward.y, toward.x);
  const pts: Point[] = [];
  for (let i = 0; i <= HALF_DISC_STEPS; i++) {
    const a = mid - Math.PI / 2 + (Math.PI * i) / HALF_DISC_STEPS;
    pts.push({ x: x + r * Math.cos(a), y: y + r * Math.sin(a) });
  }
  return polygonFromPoints(pts);
}

/**
 * The marker for an anchor at `at`, `size` px across. `kind` is its spiro kind,
 * or null for an ordinary anchor. A `left` point's line arrives from `prev`
 * and a `right` point's leaves toward `next`, both in the same screen space;
 * without that neighbor the half-disc faces right.
 */
export function anchorMarkerPath(
  kind: SpiroKind | null,
  at: Point,
  size: number,
  prev: Point | null = null,
  next: Point | null = null,
): PolygonPath {
  if (kind === 'smooth') return circlePath(at.x, at.y, size / 2);
  if (kind === 'left' || kind === 'right') {
    const from = kind === 'left' ? prev : next;
    const away = from ? { x: at.x - from.x, y: at.y - from.y } : { x: 1, y: 0 };
    const toward = away.x === 0 && away.y === 0 ? { x: 1, y: 0 } : away;
    return halfDisc(at.x, at.y, (size / 2) * 1.2, toward);
  }
  return squarePath(at.x, at.y, size);
}
