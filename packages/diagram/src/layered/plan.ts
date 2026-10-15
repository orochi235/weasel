/**
 * The layered layout's whole answer: where each node goes, and where each long
 * edge runs, read off where its placeholders were placed.
 */
import type { Vec2 } from '@weasel-js/core/math';
import { packClusters, rankGaps } from '../cluster';
import type { Graph } from '../graph';
import { backEdges } from './cycles';
import {
  DEFAULT_NODE_GAP,
  DEFAULT_RANK_GAP,
  anchorOffset,
  axesFor,
  extent,
  pinnedSet,
  translated,
  untilSettled,
  worldOf,
  type LayoutOptions,
  type LayoutResult,
  type Slot,
} from '../layout';
import { depthOf, expand } from './expand';
import { orderRows } from './order';
import { placeAcross } from './place';
import { ranksByLength } from './rank';

/** What {@link layeredPlan} works out. */
export interface LayeredPlan {
  /** The new top-left of every node that moves, as `layered` returns it. */
  moves: LayoutResult;
  /** Each node's rank. */
  ranks: ReadonlyMap<string, number>;
  /** Ids of the graph edges laid out pointing the other way. */
  back: ReadonlySet<string>;
  /** For each edge spanning ranks, keyed by the edge's id as drawn: points
   *  from its `from` end to its `to` end, two per rank it crosses, where it
   *  enters and leaves that rank. Empty unless `order` is `'barycenter'`. */
  waypoints: ReadonlyMap<string, readonly Vec2[]>;
  /** For each labeled edge given room, keyed by the edge's id as drawn: the
   *  place among its waypoints that room is beside, as a `DiagramLabel`'s
   *  `{ waypoint }` reads it. Empty unless `order` is `'barycenter'`. */
  labels: ReadonlyMap<string, number>;
}

/** How much of `rankGap` each side of a label's row keeps. */
const LABEL_GAP = 0.75;

/** The layered layout, with the ranks and edge routes it settled on. */
export function layeredPlan(graph: Graph, opts: LayoutOptions = {}): LayeredPlan {
  const plan = planOnce(graph, opts);
  // Keeping groups together can move an outsider out of a group's column,
  // which changes the order the next seeded run starts from. Barycenter
  // ordering reorders on every run, so it has no arrangement to settle on.
  if ((graph.groups?.length ?? 0) === 0 || opts.order === 'barycenter') return plan;
  return { ...plan, moves: untilSettled((g, o) => planOnce(g, o).moves, graph, opts) };
}

function planOnce(graph: Graph, opts: LayoutOptions = {}): LayeredPlan {
  const axes = axesFor(opts.direction);
  const nodeGap = opts.nodeGap ?? DEFAULT_NODE_GAP;
  const rankGap = opts.rankGap ?? DEFAULT_RANK_GAP;
  const finding = opts.order === 'barycenter';

  const back = backEdges(graph);
  const ranks = ranksByLength(graph, back);
  const expanded = expand(graph, ranks, back, { axes, nodeGap, placeholders: finding, labels: finding });
  const rows = finding ? orderRows(expanded.rows, expanded.hops, { groups: graph.groups ?? [] }) : expanded.rows;

  const preferred = placeAcross(rows, expanded.hops, axes.cross, nodeGap);
  const grouped = (graph.groups?.length ?? 0) > 0;
  const crossAt = grouped ? packClusters(graph, rows, preferred, axes, nodeGap) : preferred;
  const gaps = grouped ? rankGaps(graph, rows, axes, rankGap) : rows.slice(1).map(() => rankGap);
  // A label's row splits one gap between two ranks; each side keeps
  // `LABEL_GAP` of it, room for a wire to turn toward its label.
  for (const r of expanded.labelRows) {
    gaps[r - 1] = gaps[r - 1]! - rankGap * (1 - LABEL_GAP);
    gaps[r] = gaps[r]! - rankGap * (1 - LABEL_GAP);
  }

  const slots = new Map<string, Slot>();
  const bands: [number, number][] = [];
  let along = 0;
  for (const [i, row] of rows.entries()) {
    const depth = depthOf(row, axes);
    bands.push([along, along + depth]);
    for (const node of row) {
      // Centered in its rank's band, so a tall node does not push its
      // neighbors' edges off the line they read along.
      slots.set(node.id, { cross: crossAt.get(node.id)!, rank: along + (depth - extent(node.bounds, axes.rank)) / 2 });
    }
    along += depth + (gaps[i] ?? 0);
  }

  const placed = new Map<string, Vec2>();
  for (const node of graph.nodes) {
    const slot = slots.get(node.id);
    if (slot !== undefined) placed.set(node.id, worldOf(slot, extent(node.bounds, axes.rank), axes));
  }
  const pinned = pinnedSet(graph, opts);
  const moves = translated(graph, placed, pinned, opts.tolerance);
  const offset = anchorOffset(graph, placed, pinned);

  // A pinned node stays where it is, not where its rank would put it, so
  // placeholders laid out around its slot say nothing about a wire to it.
  const displaced = new Set<string>();
  for (const id of pinned) {
    const at = placed.get(id);
    const node = graph.node(id);
    if (at === undefined || node === undefined) continue;
    if (Math.abs(at.x + offset.x - node.bounds.x) > 0.5 || Math.abs(at.y + offset.y - node.bounds.y) > 0.5) displaced.add(id);
  }

  const waypoints = new Map<string, Vec2[]>();
  const labels = new Map<string, number>();
  const rankOf = new Map<string, number>();
  rows.forEach((row, r) => row.forEach((n) => rankOf.set(n.id, r)));
  const widthOf = new Map(rows.flat().map((n) => [n.id, extent(n.bounds, axes.cross)]));
  for (const [edge, chain] of expanded.chains) {
    if (chain.ends.some((id) => displaced.has(id))) continue;
    const beside = expanded.labels.get(edge);
    if (beside !== undefined) labels.set(edge, chain.ids.indexOf(beside) * 2 + 0.5);
    const points: Vec2[] = [];
    for (const id of chain.ids) {
      const cross = crossAt.get(id)! + (expanded.wires.get(id) ?? widthOf.get(id)! / 2);
      const [lo, hi] = bands[rankOf.get(id)!]!;
      for (const rank of chain.back ? [hi, lo] : [lo, hi]) {
        const at = worldOf({ cross, rank }, 0, axes);
        points.push({ x: at.x + offset.x, y: at.y + offset.y });
      }
    }
    waypoints.set(edge, points);
  }

  return { moves, ranks, back, waypoints, labels };
}
