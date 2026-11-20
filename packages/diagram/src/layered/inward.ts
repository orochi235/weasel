/**
 * Keeping long edges inside the drawing.
 *
 * Placement keeps a long edge's placeholders in a straight run, so a run
 * ordered past the outermost node of some rank sits past that node in every
 * rank it crosses. Where that node is the drawing's edge, the wire leaves the
 * drawing on its first hop and comes back on its last, and no placement of
 * that order can bring it in: the run is a gap and a half-width past the node
 * at least. Swapping the two can, since the node then holds the drawing's edge
 * beyond the run.
 */
import type { Graph, GraphNode } from '../graph';
import { extent, type LayoutAxes } from '../layout';
import { clusterSpans, type Span } from './clusterSpans';
import { sidesOf } from './places';
import { isPlaceholder, type Hop, type Rows } from './types';

/** What {@link turnOutward} reads. */
export interface OutwardInput {
  graph: Pick<Graph, 'clusters'>;
  rows: Rows;
  /** Each node's low corner across the rank, placeholders included. */
  crossAt: ReadonlyMap<string, number>;
  axes: LayoutAxes;
  /** Nodes that must stay where they are. */
  pinned: ReadonlySet<string>;
  hops: readonly Hop[];
}

/** How far past the drawing a placeholder may sit before its rank is reordered. */
const SLACK = 1;

/**
 * `rows` with one rank turned on each side that needs it, or `undefined` when
 * none does. A rank needs it when its outer end is a run of placeholders that
 * all reach past the real nodes and cluster boxes; of those, the one turned is
 * the rank whose outermost real node reaches furthest, which then moves beyond
 * the run. Only an unclustered, unpinned node moves, and only past placeholders
 * outside every cluster. A run whose wire meets the node's in the next rank either
 * way is a wire going around its sibling, which reads best beside it, so that
 * rank stays as it is.
 */
export function turnOutward(input: OutwardInput): Rows | undefined {
  const { rows, axes } = input;
  const size = (n: GraphNode) => extent(n.bounds, axes.cross);
  const lo = (n: GraphNode) => input.crossAt.get(n.id)!;
  const hi = (n: GraphNode) => lo(n) + size(n);
  const hull = drawingSpan(input, size);
  if (hull === undefined) return undefined;
  const free = (n: GraphNode) => n.cluster === undefined && !input.pinned.has(n.id);
  const { up, down } = sidesOf(input.hops);
  const kin = (a: string, b: string) =>
    [up, down].some((side) => (side.get(a) ?? []).some((n) => (side.get(b) ?? []).includes(n)));

  const out = rows.map((row) => [...row]);
  let changed = false;
  for (const high of [true, false]) {
    const reach = (n: GraphNode) => (high ? hi(n) : -lo(n));
    let best: { r: number; k: number; by: number } | undefined;
    for (const [r, row] of out.entries()) {
      const order = high ? [...row].reverse() : row;
      let k = 0;
      while (k < order.length && isPlaceholder(order[k]!.id) && free(order[k]!)) k++;
      const node = order[k];
      if (k === 0 || node === undefined || isPlaceholder(node.id) || !free(node)) continue;
      const run = order.slice(0, k);
      if (!run.every((p) => reach(p) - (high ? hull[1] : -hull[0]) > SLACK)) continue;
      if (run.some((p) => kin(p.id, node.id))) continue;
      if (best === undefined || reach(node) > best.by) best = { r, k, by: reach(node) };
    }
    if (best === undefined) continue;
    const order = high ? [...out[best.r]!].reverse() : out[best.r]!;
    const turned = [order[best.k]!, ...order.slice(0, best.k), ...order.slice(best.k + 1)];
    out[best.r] = high ? turned.reverse() : turned;
    changed = true;
  }
  return changed ? out : undefined;
}

/** How far the real nodes and cluster boxes reach across the rank. */
function drawingSpan(input: OutwardInput, size: (n: GraphNode) => number): Span | undefined {
  let lo = Infinity;
  let hi = -Infinity;
  const take = ([a, b]: Span) => {
    lo = Math.min(lo, a);
    hi = Math.max(hi, b);
  };
  for (const n of input.rows.flat()) {
    if (!isPlaceholder(n.id)) take([input.crossAt.get(n.id)!, input.crossAt.get(n.id)! + size(n)]);
  }
  for (const box of clusterBoxes(input, size).values()) take(box);
  return lo <= hi ? [lo, hi] : undefined;
}

/** Each cluster's box across the rank around its real nodes. */
function clusterBoxes(input: OutwardInput, size: (n: GraphNode) => number): Map<string, Span> {
  const nodes = input.rows.flat().filter((n) => !isPlaceholder(n.id));
  const at = (n: GraphNode) => input.crossAt.get(n.id)!;
  return clusterSpans(input.graph.clusters ?? [], nodes.map((n) => ({ cluster: n.cluster, span: [at(n), at(n) + size(n)] })), input.axes);
}
