/**
 * What a drag frame reroutes against, kept up to date by what moved rather
 * than rebuilt: the committed obstacles in a spatial hash with this frame's
 * moved ones swapped in, the committed routes in a segment index, and which
 * connectors meet each shape. Built at commit and seed, when the router
 * already reads everything.
 */
import type { Vec2 } from '@weasel-js/core/math';
import { ObstacleIndex } from './obstacles';
import { SegmentIndex } from './segments';
import { inflate, type AvoidInput, type AvoidObstacle, type Box } from './types';

const sameBox = (a: Box, b: Box) => a.x === b.x && a.y === b.y && a.width === b.width && a.height === b.height;

/** The box holding `a` and `b`. */
function union(a: Box, b: Box): Box {
  const x = Math.min(a.x, b.x);
  const y = Math.min(a.y, b.y);
  return { x, y, width: Math.max(a.x + a.width, b.x + b.width) - x, height: Math.max(a.y + a.height, b.y + b.height) - y };
}

/** One drag frame as the router routes it. */
export interface DragFrame {
  index: ObstacleIndex;
  /** The connectors to reroute, those attached to a moved shape first. */
  dirty: string[];
  limit: Box;
}

export class DragIndex {
  private readonly committed = new Map<string, AvoidObstacle>();
  /** The obstacles this frame has moved off their committed place, as they now are. */
  private readonly displaced = new Map<string, AvoidObstacle>();
  private readonly index: ObstacleIndex;
  private readonly segments = new SegmentIndex();
  private readonly attached = new Map<string, string[]>();

  constructor(input: AvoidInput, routes: ReadonlyMap<string, readonly Vec2[]>, private readonly clearance: number, private readonly limit: Box) {
    for (const o of input.obstacles) this.committed.set(o.id, o);
    this.index = new ObstacleIndex(input.obstacles, clearance);
    for (const e of input.edges) {
      for (const node of new Set([e.from.node, e.to.node])) {
        const list = this.attached.get(node);
        if (list === undefined) this.attached.set(node, [e.id]);
        else list.push(e.id);
      }
      const route = routes.get(e.id);
      if (route !== undefined) this.segments.add(e.id, route);
    }
  }

  /** Swap this frame's obstacles into the index where they moved, and answer
   *  what it reroutes. Diffs the frame's obstacles against the last frame's;
   *  touches the hash and the connectors only for the ones that moved. */
  frame(obstacles: readonly AvoidObstacle[]): DragFrame {
    const seen = new Set<string>();
    for (const o of obstacles) {
      const base = this.committed.get(o.id);
      if (base === undefined) continue;
      const now = this.displaced.get(o.id) ?? base;
      if (sameBox(now.box, o.box)) {
        if (this.displaced.has(o.id)) seen.add(o.id);
        continue;
      }
      this.index.replace(o);
      if (sameBox(base.box, o.box)) this.displaced.delete(o.id);
      else {
        this.displaced.set(o.id, o);
        seen.add(o.id);
      }
    }
    for (const [id] of this.displaced) {
      if (seen.has(id)) continue;
      this.index.replace(this.committed.get(id)!);
      this.displaced.delete(id);
    }
    const first = new Set<string>();
    const meeting = new Set<string>();
    let limit = this.limit;
    for (const [id, o] of this.displaced) {
      for (const e of this.attached.get(id) ?? []) first.add(e);
      this.segments.edgesMeeting(inflate(this.committed.get(id)!.box, this.clearance), meeting);
      this.segments.edgesMeeting(inflate(o.box, this.clearance), meeting);
      limit = union(limit, o.box);
    }
    return { index: this.index, dirty: [...first, ...[...meeting].filter((e) => !first.has(e))], limit };
  }
}
