/**
 * How a spiro point is marked, by its kind: a circle for a smooth point, a
 * diamond for a g4 point, a square for a corner, and a half-disc for a point
 * beside a straight segment, its flat side toward the line.
 */
import { circlePath, polygonFromPoints, squarePath, type PolygonPath, type SpiroKind } from '@weasel-js/geom';
import type { AnchorMarkerShape } from '@weasel-js/core';

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
 * The marker shape of a spiro point of `kind`. A `left` point's line arrives
 * from its previous neighbor and a `right` point's leaves toward its next,
 * both in the same screen space; without that neighbor the half-disc faces
 * right.
 */
export function spiroMarker(kind: SpiroKind): AnchorMarkerShape {
  if (kind === 'smooth') return (at, size) => circlePath(at.x, at.y, size / 2);
  if (kind === 'corner') return (at, size) => squarePath(at.x, at.y, size);
  if (kind === 'g4') {
    return (at, size) => {
      const r = (size / 2) * 1.25;
      return polygonFromPoints([
        { x: at.x, y: at.y - r }, { x: at.x + r, y: at.y }, { x: at.x, y: at.y + r }, { x: at.x - r, y: at.y },
      ]);
    };
  }
  return (at, size, prev, next) => {
    const from = kind === 'left' ? prev : next;
    const away = from ? { x: at.x - from.x, y: at.y - from.y } : { x: 1, y: 0 };
    const toward = away.x === 0 && away.y === 0 ? { x: 1, y: 0 } : away;
    return halfDisc(at.x, at.y, (size / 2) * 1.2, toward);
  };
}
