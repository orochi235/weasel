/**
 * The layered layout's whole answer: where each node goes, and where each long
 * edge runs, read off where its placeholders were placed.
 */
import type { Vec2 } from '@weasel-js/core/math';
import { packClusters, rankGaps } from '../cluster';
import type { Graph, GraphEdge } from '../graph';
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
  type LayoutPorts,
  type LayoutResult,
  type Slot,
} from '../layout';
import { expand } from './expand';
import { orderRows } from './order';
import { levelRoutes } from './level';
import { holdPins } from './pins';
import { turnOutward } from './inward';
import { boxReach } from './reach';
import { placeAcross } from './place';
import { ranksByLength } from './rank';
import { settlePlaces } from './places';
import { layeredPorts } from '../route';

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
   *  enters and leaves that rank. */
  waypoints: ReadonlyMap<string, readonly Vec2[]>;
  /** For each labeled edge given room, keyed by the edge's id as drawn: the
   *  point on its route that room is beside, as a `DiagramLabel`'s
   *  `{ near }` reads it. */
  labels: ReadonlyMap<string, Vec2>;
  /** For each edge running between ranks, keyed by the edge's id as drawn:
   *  the compass ports facing the way it runs (see `layeredPorts`). */
  ports: ReadonlyMap<string, LayoutPorts>;
  /** Pinned nodes after the first that the layout could not be built
   *  around: covering one with its rank's band would bring that band nearer
   *  another pinned rank's than the bands between them allow with every gap
   *  at a quarter of `rankGap` beyond its groups' insets, or would put a
   *  group's box over a pin it does not hold. They stay put, and the rest is
   *  laid out around the slot each would have had. */
  unheld: ReadonlySet<string>;
}

/** How much of `rankGap` each side of a label's row keeps. */
const LABEL_GAP = 0.75;
/** How much of `rankGap` a gap keeps when it shrinks to reach a pin. */
const MIN_GAP = 0.25;
/** The layered layout, with the ranks and edge routes it settled on. */
export function layeredPlan(graph: Graph, opts: LayoutOptions = {}): LayeredPlan {
  // Keeping groups together can move an outsider out of a group's column,
  // which changes the order the next seeded run starts from. Barycenter
  // ordering reorders on every run, so it has no arrangement to settle on.
  if ((graph.groups?.length ?? 0) === 0 || opts.order === 'barycenter') return planOnce(graph, opts);
  // Each pass starts its placeholders on the routes the pass before laid out,
  // and the routes kept are the last pass's.
  let last: LayeredPlan | undefined;
  const moves = untilSettled((g, o) => {
    last = planOnce(last === undefined ? g : { ...g, edges: g.edges.map((e) => routed(e, last!)) }, o);
    return last.moves;
  }, graph, opts);
  return { ...last!, moves };
}

function routed(edge: GraphEdge, plan: LayeredPlan): GraphEdge {
  const { waypoints: _, ...rest } = edge;
  const route = plan.waypoints.get(edge.origin?.id ?? edge.id);
  return route === undefined ? rest : { ...rest, waypoints: route };
}

function planOnce(graph: Graph, opts: LayoutOptions = {}): LayeredPlan {
  const axes = axesFor(opts.direction);
  const nodeGap = opts.nodeGap ?? DEFAULT_NODE_GAP;
  const rankGap = opts.rankGap ?? DEFAULT_RANK_GAP;
  const finding = opts.order === 'barycenter';

  const back = backEdges(graph);
  const ranks = ranksByLength(graph, back);
  const expanded = expand(graph, ranks, back, { axes, nodeGap });
  let rows = finding ? orderRows(expanded.rows, expanded.hops, { groups: graph.groups ?? [] }) : expanded.rows;

  const grouped = (graph.groups?.length ?? 0) > 0;
  const pinned = pinnedSet(graph, opts);
  const across = () => {
    const preferred = placeAcross(rows, settlePlaces(rows, expanded.hops), axes.cross, nodeGap);
    return grouped ? packClusters(graph, rows, preferred, axes, nodeGap) : preferred;
  };
  let packed = across();
  for (let turn = 0; turn < rows.length; turn++) {
    const turned = turnOutward({ graph, rows, crossAt: packed, axes, pinned, hops: expanded.hops });
    if (turned === undefined) break;
    rows = turned;
    packed = across();
  }
  const spaced = grouped ? rankGaps(graph, rows, axes, rankGap) : rows.slice(1).map(() => rankGap);
  // A gap keeps the room its groups' insets take on top of `rankGap`.
  const minGaps = spaced.map((gap) => gap - rankGap + rankGap * MIN_GAP);
  // A label's row splits one gap between two ranks; each side keeps
  // `LABEL_GAP` of it, room for a wire to turn toward its label.
  for (const r of expanded.labelRows) {
    spaced[r - 1] = spaced[r - 1]! - rankGap * (1 - LABEL_GAP);
    spaced[r] = spaced[r]! - rankGap * (1 - LABEL_GAP);
  }
  const { crossAt, gaps, depths, rankAt, unheld } = holdPins({ graph, rows, crossAt: packed, gaps: spaced, pinned, axes, nodeGap, minGaps });

  const slots = new Map<string, Slot>();
  const bands: [number, number][] = [];
  let along = 0;
  for (const [i, row] of rows.entries()) {
    const depth = depths[i]!;
    bands.push([along, along + depth]);
    for (const node of row) {
      // Centered in its rank's band, so a tall node does not push its
      // neighbors' edges off the line they read along.
      slots.set(node.id, { cross: crossAt.get(node.id)!, rank: rankAt.get(node.id) ?? along + (depth - extent(node.bounds, axes.rank)) / 2 });
    }
    along += depth + (gaps[i] ?? 0);
  }

  const placed = new Map<string, Vec2>();
  for (const node of graph.nodes) {
    const slot = slots.get(node.id);
    if (slot !== undefined) placed.set(node.id, worldOf(slot, extent(node.bounds, axes.rank), axes));
  }
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
  const labels = new Map<string, Vec2>();
  const rankOf = new Map<string, number>();
  rows.forEach((row, r) => row.forEach((n) => rankOf.set(n.id, r)));
  const reach = boxReach(graph, rows, axes);
  const widthOf = new Map(rows.flat().map((n) => [n.id, extent(n.bounds, axes.cross)]));
  for (const [edge, chain] of expanded.chains) {
    if (chain.ends.some((id) => displaced.has(id))) continue;
    const beside = chain.ids.indexOf(expanded.labels.get(edge) ?? '');
    const points: Vec2[] = [];
    for (const id of chain.ids) {
      const cross = crossAt.get(id)! + (expanded.wires.get(id) ?? widthOf.get(id)! / 2);
      // A wire passing a group's box enters and leaves level with its edge,
      // so the turns either side of the run stay clear of the box.
      const r = rankOf.get(id)!;
      const [lo, hi] = [bands[r]![0] - reach.lo[r]!, bands[r]![1] + reach.hi[r]!];
      for (const rank of chain.back ? [hi, lo] : [lo, hi]) {
        const at = worldOf({ cross, rank }, 0, axes);
        points.push({ x: at.x + offset.x, y: at.y + offset.y });
      }
    }
    waypoints.set(edge, points);
    if (beside >= 0) {
      const [a, b] = [points[beside * 2]!, points[beside * 2 + 1]!];
      labels.set(edge, { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
    }
  }

  const ports = layeredPorts(graph, ranks, opts.direction);
  const boxes = new Map(graph.nodes.map((n) => [n.id, { ...n.bounds, ...moves.get(n.id) }]));
  const level = levelRoutes({ graph, boxes, axes, rankGap, ...(opts.direction !== undefined ? { direction: opts.direction } : {}) });
  for (const [edge, named] of level.ports) {
    ports.set(edge, named);
    waypoints.delete(edge);
    labels.delete(edge);
  }
  for (const [edge, points] of level.waypoints) waypoints.set(edge, points);
  return { moves, ranks, back, waypoints, labels, ports, unheld };
}
