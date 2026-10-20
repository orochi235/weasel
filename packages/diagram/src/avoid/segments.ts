/**
 * Connectors' routes as axis-aligned segments in a spatial hash: what the
 * search counts crossings against, and what finds the routes a moved obstacle
 * meets.
 */
import type { Vec2 } from '@weasel-js/core/math';
import { SpatialHash } from './hash';
import type { Box } from './types';

/** One segment of one connector's route. */
export interface RouteSegment {
  edge: string;
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

const EPS = 1e-7;

const boxOf = (s: RouteSegment): Box => ({
  x: Math.min(s.x0, s.x1), y: Math.min(s.y0, s.y1), width: Math.abs(s.x1 - s.x0), height: Math.abs(s.y1 - s.y0),
});

/** Whether segment `s` shares a point with the inside or edge of `box`. */
function touches(s: RouteSegment, box: Box): boolean {
  const b = boxOf(s);
  return b.x <= box.x + box.width && box.x <= b.x + b.width && b.y <= box.y + box.height && box.y <= b.y + b.height;
}

export class SegmentIndex {
  private readonly hash = new SpatialHash<RouteSegment>();
  private readonly scratch: RouteSegment[] = [];

  /** File every segment of `points`, connector `edge`'s polyline. */
  add(edge: string, points: readonly Vec2[]): void {
    for (let i = 0; i + 1 < points.length; i++) {
      const a = points[i]!;
      const b = points[i + 1]!;
      const s = { edge, x0: a.x, y0: a.y, x1: b.x, y1: b.y };
      this.hash.insert(s, boxOf(s));
    }
  }

  /** The connectors with a segment touching `box`. */
  edgesMeeting(box: Box, into: Set<string>): void {
    for (const s of this.hash.query(box)) if (touches(s, box)) into.add(s.edge);
  }

  /** How many segments of connectors other than `self` the axis-aligned step
   *  from `(x0, y0)` to `(x1, y1)` crosses at right angles. */
  crossings(self: string, x0: number, y0: number, x1: number, y1: number): number {
    const lx = Math.min(x0, x1);
    const hx = Math.max(x0, x1);
    const ly = Math.min(y0, y1);
    const hy = Math.max(y0, y1);
    const horizontal = ly === hy;
    this.scratch.length = 0;
    let n = 0;
    for (const s of this.hash.query({ x: lx, y: ly, width: hx - lx, height: hy - ly }, this.scratch)) {
      if (s.edge === self) continue;
      if (horizontal) {
        if (Math.abs(s.x0 - s.x1) > EPS) continue;
        const sl = Math.min(s.y0, s.y1);
        const sh = Math.max(s.y0, s.y1);
        if (s.x0 > lx + EPS && s.x0 < hx - EPS && ly > sl + EPS && ly < sh - EPS) n++;
      } else {
        if (Math.abs(s.y0 - s.y1) > EPS) continue;
        const sl = Math.min(s.x0, s.x1);
        const sh = Math.max(s.x0, s.x1);
        if (s.y0 > ly + EPS && s.y0 < hy - EPS && lx > sl + EPS && lx < sh - EPS) n++;
      }
    }
    return n;
  }
}
