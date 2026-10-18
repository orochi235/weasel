/**
 * `chain` — one run of nodes on a straight line, and everything else hung
 * beside the chain node it is nearest to.
 *
 * The signal-chain layout: a rack of effects with their side inputs under
 * them. Each chain node owns a column as long as the widest row hung on it, so
 * two neighbors' hangers never share space. Groups are ignored.
 */
import { inPortOrder, SIDE_TRACK_GAP, sideRoutes, tracksNeeded, type Hanging } from './chainRoutes';
import type { Graph, GraphNode } from './graph';
import { backEdges, ranksOf } from './layered';
import {
  DEFAULT_NODE_GAP,
  DEFAULT_RANK_GAP,
  axesFor,
  extent,
  settle,
  type LayoutAxes,
  type LayoutFn,
  type LayoutOptions,
  type LayoutPlan,
  type Slot,
} from './layout';

/** The nodes that stand on the line: those of the ids given that are nodes,
 *  or the longest path when none is. */
function lineOf(graph: Graph, ids: readonly string[] | undefined): GraphNode[] {
  const seen = new Set<string>();
  const given = (ids ?? []).flatMap((id) => {
    const node = graph.node(id);
    if (node === undefined || seen.has(id)) return [];
    seen.add(id);
    return [node];
  });
  if (given.length > 0) return given;
  const back = backEdges(graph);
  const ranks = ranksOf(graph, back);
  let end: GraphNode | undefined;
  for (const node of graph.nodes) {
    if (end === undefined || ranks.get(node.id)! > ranks.get(end.id)!) end = node;
  }
  const line: GraphNode[] = [];
  for (let at = end; at !== undefined;) {
    line.unshift(at);
    const rank = ranks.get(at.id)!;
    const edge = graph.incoming(at.id).find((e) => !back.has(e.id) && ranks.get(e.from) === rank - 1);
    at = edge === undefined ? undefined : graph.node(edge.from);
  }
  return line;
}

/** Breadth-first from the line, so a node hangs on the chain node it is
 *  fewest edges from, at that many steps out. A node no edge reaches hangs on
 *  the last chain node, one step out. */
function hangFrom(graph: Graph, line: readonly GraphNode[]): Hanging {
  const owner = new Map<string, string>(line.map((n) => [n.id, n.id]));
  const level = new Map<string, number>(line.map((n) => [n.id, 0]));
  for (let frontier = line.map((n) => n.id); frontier.length > 0;) {
    const next: string[] = [];
    for (const id of frontier) {
      const near = [...graph.incoming(id).map((e) => e.from), ...graph.outgoing(id).map((e) => e.to)];
      for (const other of near) {
        if (owner.has(other) || graph.node(other) === undefined) continue;
        owner.set(other, owner.get(id)!);
        level.set(other, level.get(id)! + 1);
        next.push(other);
      }
    }
    frontier = next;
  }
  const last = line[line.length - 1]!.id;
  for (const node of graph.nodes) {
    if (owner.has(node.id)) continue;
    owner.set(node.id, last);
    level.set(node.id, 1);
  }
  return { owner, level };
}

/** The chain layout: the nodes `opts.chain` names (or the longest path) on
 *  one line in order, and every other node hung beside the chain node it is
 *  fewest edges from, on the `opts.chainSide` side. Its `plan` also routes
 *  each edge between a chain node and a node hung beside it through a track
 *  of its own, so a fan of them into one node does not cross itself. */
export const chain: LayoutFn = Object.assign(
  (graph: Graph, opts: LayoutOptions = {}) => chainPlan(graph, opts).moves,
  { plan: chainPlan },
);

function chainPlan(graph: Graph, opts: LayoutOptions = {}): LayoutPlan {
  const axes = axesFor(opts.direction);
  const nodeGap = opts.nodeGap ?? DEFAULT_NODE_GAP;
  const rankGap = opts.rankGap ?? DEFAULT_RANK_GAP;
  const line = lineOf(graph, opts.chain);
  if (line.length === 0) return { moves: new Map() };
  const hanging = hangFrom(graph, line);
  const { owner, level } = hanging;

  const rows = new Map<string, GraphNode[][]>(line.map((n) => [n.id, []]));
  const levelSize: number[] = [Math.max(...line.map((n) => extent(n.bounds, axes.cross)))];
  for (const node of graph.nodes) {
    const at = level.get(node.id)!;
    if (at === 0) continue;
    const column = rows.get(owner.get(node.id)!)!;
    (column[at] ??= []).push(node);
    levelSize[at] = Math.max(levelSize[at] ?? 0, extent(node.bounds, axes.cross));
  }
  for (const [id, column] of rows) if (column[1]) column[1] = inPortOrder(graph, id, column[1], axes);
  const before = opts.chainSide === 'before';
  const place = (side: number) => settle(graph, slotsFor(line, rows, levelSize, axes, { node: nodeGap, rank: rankGap, side }, before), opts);
  // Where a side edge turns depends only on positions along the line, which
  // the gap across it does not move, so one trial run counts the tracks.
  let moves = place(nodeGap);
  const side = (tracksNeeded(graph, hanging, moves, axes, before) + 1) * SIDE_TRACK_GAP;
  if (side > nodeGap) moves = place(side);
  return { moves, waypoints: sideRoutes(graph, hanging, moves, axes, before) };
}

function slotsFor(
  line: readonly GraphNode[],
  rows: ReadonlyMap<string, GraphNode[][]>,
  levelSize: readonly number[],
  axes: LayoutAxes,
  gaps: { node: number; rank: number; side: number },
  before: boolean,
): Map<string, Slot> {
  const { node: nodeGap, rank: rankGap } = gaps;
  const rowSpan = (row: readonly GraphNode[]) =>
    row.reduce((sum, n) => sum + extent(n.bounds, axes.rank), 0) + nodeGap * Math.max(row.length - 1, 0);
  /** The low cross edge of level `at`'s band, the line's own being 0. The
   *  gap between the line and the first band is `gaps.side`. */
  const bandStart = (at: number): number => {
    let offset = 0;
    const first = before ? 1 : 0;
    for (let k = first; k < (before ? at + 1 : at); k++) offset += (levelSize[k] ?? 0) + (k === first ? gaps.side : nodeGap);
    return before ? -offset : offset;
  };

  const slots = new Map<string, Slot>();
  let cursor = 0;
  for (const node of line) {
    const column = rows.get(node.id)!;
    const span = Math.max(extent(node.bounds, axes.rank), ...Array.from(column, (row) => (row ? rowSpan(row) : 0)));
    slots.set(node.id, {
      cross: (levelSize[0]! - extent(node.bounds, axes.cross)) / 2,
      rank: cursor + (span - extent(node.bounds, axes.rank)) / 2,
    });
    column.forEach((row, at) => {
      if (!row) return;
      let along = cursor + (span - rowSpan(row)) / 2;
      for (const hung of row) {
        // Hung against the edge of its band that faces the line.
        const cross = before ? bandStart(at) + levelSize[at]! - extent(hung.bounds, axes.cross) : bandStart(at);
        slots.set(hung.id, { cross, rank: along });
        along += extent(hung.bounds, axes.rank) + nodeGap;
      }
    });
    cursor += span + rankGap;
  }
  return slots;
}
