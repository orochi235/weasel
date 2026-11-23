/**
 * What a drag frame reroutes against, kept up to date by what moved rather
 * than rebuilt: the committed obstacles in a spatial hash with this frame's
 * moved ones swapped in, the committed routes in a segment index, and which
 * connectors meet each shape. Built at commit and seed, when the router
 * already reads everything.
 */
import type { Vec2 } from '@weasel-js/core/math';
import { growRect, rectsEqual, unionRects } from '@weasel-js/geom';
import { finiteBox } from './grid';
import { inflatedBox, ObstacleIndex } from './obstacles';
import { SegmentIndex } from './segments';
import { type AvoidInput, type AvoidObstacle, type Box } from './types';

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

  constructor(
    input: AvoidInput,
    routes: ReadonlyMap<string, readonly Vec2[]>,
    private readonly clearance: number,
    private readonly limit: Box,
    private readonly labelClearance = clearance,
    /** The room past a moved shape its frame's limit keeps, as the commit's limit keeps past every box. */
    private readonly margin = 0,
  ) {
    for (const o of input.obstacles) this.committed.set(o.id, o);
    this.index = new ObstacleIndex(input.obstacles, clearance, labelClearance);
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
      if (rectsEqual(now.box, o.box)) {
        if (this.displaced.has(o.id)) seen.add(o.id);
        continue;
      }
      this.index.replace(o);
      if (rectsEqual(base.box, o.box)) this.displaced.delete(o.id);
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
      this.segments.edgesMeeting(inflatedBox(this.committed.get(id)!, this.clearance, this.labelClearance), meeting);
      this.segments.edgesMeeting(inflatedBox(o, this.clearance, this.labelClearance), meeting);
      if (finiteBox(o.box)) limit = unionRects([limit, growRect(o.box, 2 * this.margin)])!;
    }
    return { index: this.index, dirty: [...first, ...[...meeting].filter((e) => !first.has(e))], limit };
  }
}
