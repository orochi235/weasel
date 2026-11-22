/**
 * `force3` — the force-directed layout in three dimensions, for a graph of
 * solids: each node's `box3` (from a frame's `box3`) relaxed in depth as well
 * as across the plane.
 */
import type { Vec3 } from '@weasel-js/geom/3d';
import { createForceRelaxation, type ForceOptions } from './force';
import type { Graph } from './graph';
import { anchorOffset } from './layout';

/** The new low corner of the box each node covers in three dimensions, for
 *  each node that moves. */
export type Layout3Result = ReadonlyMap<string, Vec3>;

const DEFAULT_ITERATIONS = 300;
const DEFAULT_TOLERANCE = 1e-6;

/**
 * `force` run in three dimensions. A node without a `box3` is flat, at z = 0.
 * Anchored as `force` is — onto the first pinned node, else so the low corner
 * of the run lands on the graph's — and on z the same way. Not idempotent, for
 * the same reason `force` is not.
 *
 * Solids that all share one z stay on it, and land where `force` puts their
 * faces: nothing pushes a level pair off its level.
 */
export function force3(graph: Graph, opts: ForceOptions = {}): Layout3Result {
  if (graph.nodes.length === 0) return new Map();
  const relaxation = createForceRelaxation(graph, opts, 3);
  relaxation.sim.tick(opts.iterations ?? DEFAULT_ITERATIONS);
  const placed = relaxation.placed3();
  const pinned = relaxation.pinned;
  const plane = anchorOffset(graph, placed, pinned);
  const dz = depthOffset(graph, placed, pinned);
  const tolerance = opts.tolerance ?? DEFAULT_TOLERANCE;

  const out = new Map<string, Vec3>();
  for (const node of graph.nodes) {
    const at = placed.get(node.id);
    if (at === undefined || pinned.has(node.id)) continue;
    const to = { x: at.x + plane.x, y: at.y + plane.y, z: at.z + dz };
    const from = node.box3?.min.z ?? 0;
    if (
      Math.abs(to.x - node.bounds.x) <= tolerance &&
      Math.abs(to.y - node.bounds.y) <= tolerance &&
      Math.abs(to.z - from) <= tolerance
    ) continue;
    out.set(node.id, to);
  }
  return out;
}

/** {@link anchorOffset} on z: onto the first pinned node, else so the run's
 *  lowest z lands on the graph's. */
function depthOffset(graph: Graph, placed: ReadonlyMap<string, Vec3>, pinned: ReadonlySet<string>): number {
  const low = (node: Graph['nodes'][number]) => node.box3?.min.z ?? 0;
  for (const node of graph.nodes) {
    if (!pinned.has(node.id)) continue;
    const at = placed.get(node.id);
    if (at !== undefined) return low(node) - at.z;
  }
  let cur = Infinity;
  let now = Infinity;
  for (const node of graph.nodes) {
    const at = placed.get(node.id);
    if (at === undefined) continue;
    cur = Math.min(cur, low(node));
    now = Math.min(now, at.z);
  }
  return Number.isFinite(cur) ? cur - now : 0;
}
