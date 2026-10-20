/**
 * The inflated obstacles one search routes around, and the two questions it
 * asks of them: is this point inside one, and does this axis-aligned step
 * cross one's interior. Boundaries are free, so a route may run along an
 * inflated edge.
 */
import { SpatialHash } from './hash';
import { blocks, inflate, type AvoidObstacle, type Box } from './types';

/** An obstacle grown by the clearance. */
export interface Inflated {
  obstacle: AvoidObstacle;
  box: Box;
}

const EPS = 1e-7;

/** Every obstacle, inflated, filed in a spatial hash. */
export class ObstacleIndex {
  readonly all: readonly Inflated[];
  private readonly hash = new SpatialHash<Inflated>();

  constructor(obstacles: readonly AvoidObstacle[], clearance: number) {
    this.all = obstacles.map((obstacle) => ({ obstacle, box: inflate(obstacle.box, clearance) }));
    for (const item of this.all) this.hash.insert(item, item.box);
  }

  /** The inflated obstacles touching `box`. */
  near(box: Box, out: Inflated[] = []): Inflated[] {
    return this.hash.query(box, out);
  }

  /** A view of the index for one connector between shapes `from` and `to`. */
  forEdge(from: string, to: string): EdgeObstacles {
    return new EdgeObstacles(this, from, to);
  }
}

/** The obstacles that block one connector. */
export class EdgeObstacles {
  private readonly scratch: Inflated[] = [];

  constructor(private readonly index: ObstacleIndex, private readonly from: string, private readonly to: string) {}

  /** The inflated boxes blocking this connector that touch `box`. */
  near(box: Box): Box[] {
    this.scratch.length = 0;
    const out: Box[] = [];
    for (const o of this.index.near(box, this.scratch)) if (blocks(o.obstacle, this.from, this.to)) out.push(o.box);
    return out;
  }

  /** Whether `(x, y)` lies strictly inside a blocking obstacle. */
  inside(x: number, y: number): boolean {
    this.scratch.length = 0;
    for (const o of this.index.near({ x, y, width: 0, height: 0 }, this.scratch)) {
      const b = o.box;
      if (x > b.x + EPS && x < b.x + b.width - EPS && y > b.y + EPS && y < b.y + b.height - EPS && blocks(o.obstacle, this.from, this.to)) return true;
    }
    return false;
  }

  /** Whether the axis-aligned step from `(x0, y0)` to `(x1, y1)` crosses a
   *  blocking obstacle's interior. */
  crosses(x0: number, y0: number, x1: number, y1: number): boolean {
    const lx = Math.min(x0, x1);
    const hx = Math.max(x0, x1);
    const ly = Math.min(y0, y1);
    const hy = Math.max(y0, y1);
    this.scratch.length = 0;
    for (const o of this.index.near({ x: lx, y: ly, width: hx - lx, height: hy - ly }, this.scratch)) {
      const b = o.box;
      if (hx > b.x + EPS && lx < b.x + b.width - EPS && hy > b.y + EPS && ly < b.y + b.height - EPS
        && blocks(o.obstacle, this.from, this.to)) return true;
    }
    return false;
  }
}
