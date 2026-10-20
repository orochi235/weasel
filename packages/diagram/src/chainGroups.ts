/**
 * Groups in the `chain` layout: each group's members hang in one stretch of
 * columns, nothing else hangs among them, and the gaps along the line leave
 * room for its box.
 *
 * The line's order is the signal's order, so a group whose line members a
 * non-member splits keeps its box over that non-member.
 */
import type { Hanging } from './chainRoutes';
import { rankGaps, rankInset } from './cluster';
import type { Graph, GraphGroup, GraphNode } from './graph';
import { extent, type LayoutAxes, type Slot } from './layout';

function depths(groups: readonly GraphGroup[]): Map<string, number> {
  const byId = new Map(groups.map((g) => [g.id, g]));
  const depth = new Map<string, number>();
  const of = (g: GraphGroup): number => {
    if (!depth.has(g.id)) {
      const parent = g.parent === undefined ? undefined : byId.get(g.parent);
      depth.set(g.id, parent === undefined ? 0 : of(parent) + 1);
    }
    return depth.get(g.id)!;
  };
  groups.forEach(of);
  return depth;
}

const deepestFirst = (groups: readonly GraphGroup[]): GraphGroup[] => {
  const depth = depths(groups);
  return [...groups].sort((p, q) => depth.get(q.id)! - depth.get(p.id)!);
};

/**
 * Re-hang `hanging` so groups stay together. A hung member moves to the line
 * member of its own group (or the nearest enclosing one that has any) nearest
 * along the line to where it first hung. A group with no line member hangs
 * all its members on the owner most of them had, ties going to the earliest
 * on the line. A non-member hung in a column a group holds moves out past
 * that group's deepest member, keeping its order.
 */
export function groupHanging(graph: Graph, line: readonly GraphNode[], hanging: Hanging): Hanging {
  const groups = graph.groups ?? [];
  if (groups.length === 0) return hanging;
  const index = new Map(line.map((n, i) => [n.id, i]));
  const byId = new Map(groups.map((g) => [g.id, g]));
  const onLine = new Map(groups.map((g) => [g.id, g.members.filter((m) => index.has(m))]));
  const owner = new Map(hanging.owner);

  for (const node of graph.nodes) {
    if (index.has(node.id)) continue;
    const first = index.get(hanging.owner.get(node.id)!)!;
    for (let g = node.group === undefined ? undefined : byId.get(node.group); g !== undefined;
      g = g.parent === undefined ? undefined : byId.get(g.parent)) {
      const members = onLine.get(g.id)!;
      if (members.length === 0) continue;
      owner.set(node.id, nearest(members, first, index));
      break;
    }
  }
  // Deepest first, so an enclosing group with no line member settles last.
  const ordered = deepestFirst(groups);
  for (const g of ordered) {
    if (onLine.get(g.id)!.length > 0) continue;
    const hung = g.members.filter((m) => owner.has(m));
    if (hung.length === 0) continue;
    const counts = new Map<string, number>();
    for (const m of hung) counts.set(owner.get(m)!, (counts.get(owner.get(m)!) ?? 0) + 1);
    let best = owner.get(hung[0]!)!;
    for (const [id, n] of counts) {
      const lead = counts.get(best)!;
      if (n > lead || (n === lead && index.get(id)! < index.get(best)!)) best = id;
    }
    for (const m of hung) owner.set(m, best);
  }
  return { owner, level: clearColumns(graph, ordered, index, owner, hanging.level) };
}

function nearest(members: readonly string[], from: number, index: ReadonlyMap<string, number>): string {
  let best = members[0]!;
  for (const m of members) {
    const d = Math.abs(index.get(m)! - from);
    const lead = Math.abs(index.get(best)! - from);
    if (d < lead || (d === lead && index.get(m)! < index.get(best)!)) best = m;
  }
  return best;
}

/** Move the non-members of each group in a column out past its deepest
 *  member there. Groups that hold the column's line node go last, and the
 *  others leave those groups' members where they are, since a box that
 *  starts at the line has to come first. */
function clearColumns(
  graph: Graph,
  ordered: readonly GraphGroup[],
  index: ReadonlyMap<string, number>,
  owner: ReadonlyMap<string, string>,
  start: ReadonlyMap<string, number>,
): Map<string, number> {
  const level = new Map(start);
  const columns = new Map<string, string[]>();
  for (const node of graph.nodes) {
    if (index.has(node.id)) continue;
    const id = owner.get(node.id)!;
    columns.set(id, [...(columns.get(id) ?? []), node.id]);
  }
  for (const [lineId, hung] of columns) {
    const holding = ordered.filter((g) => g.members.some((m) => m === lineId || hung.includes(m)));
    const atLine = holding.filter((g) => g.members.includes(lineId));
    const kept = new Set(atLine.flatMap((g) => g.members));
    const clear = (g: GraphGroup, fixed: ReadonlySet<string>) => {
      const members = new Set(g.members);
      const own = hung.filter((id) => members.has(id)).map((id) => level.get(id)!);
      const low = members.has(lineId) ? 0 : Math.min(...own);
      const deep = Math.max(0, ...own);
      const movers = hung.filter((id) => !members.has(id) && !fixed.has(id) && level.get(id)! >= low);
      if (!movers.some((id) => level.get(id)! <= deep)) return;
      const steps = [...new Set(movers.map((id) => level.get(id)!))].sort((p, q) => p - q);
      for (const id of movers) level.set(id, deep + 1 + steps.indexOf(level.get(id)!));
    };
    for (const g of holding) if (!atLine.includes(g)) clear(g, kept);
    for (const g of atLine) clear(g, new Set());
  }
  return level;
}

/**
 * The gap after each line node but the last: `rankGap`, widened by the
 * rank-side insets of the groups that end at the node before it or start at
 * the one after, the way `rankGaps` widens a layered layout's ranks. Then,
 * along a horizontal line, each group's gaps on either side widen by half
 * of what its box falls short of its `minWidth`. `packed` is every node's
 * slot with all gaps zero.
 */
export function lineGaps(
  graph: Graph,
  line: readonly GraphNode[],
  hanging: Hanging,
  rankGap: number,
  axes: LayoutAxes,
  packed: ReadonlyMap<string, Slot>,
): number[] {
  const index = new Map(line.map((n, i) => [n.id, i]));
  const columns = line.map((n) => [n]);
  for (const node of graph.nodes) {
    if (!index.has(node.id)) columns[index.get(hanging.owner.get(node.id)!)!]!.push(node);
  }
  const gaps = rankGaps(graph, columns, axes, rankGap);
  const groups = graph.groups ?? [];
  if (axes.rank !== 'x' || !groups.some((g) => g.minWidth !== undefined)) return gaps;

  const columnOf = (id: string) => index.get(id) ?? index.get(hanging.owner.get(id)!)!;
  const children = new Map<string, string[]>();
  for (const g of groups) if (g.parent !== undefined) children.set(g.parent, [...(children.get(g.parent) ?? []), g.id]);
  const byId = new Map(groups.map((g) => [g.id, g]));
  const span = (id: string, now: readonly number[]) => {
    let [lo, hi] = [Infinity, -Infinity];
    for (const m of byId.get(id)!.members) {
      const slot = packed.get(m);
      const node = graph.node(m);
      if (slot === undefined || node === undefined) continue;
      const from = slot.rank + now.slice(0, columnOf(m)).reduce((s, gap) => s + gap, 0);
      [lo, hi] = [Math.min(lo, from), Math.max(hi, from + extent(node.bounds, axes.rank))];
    }
    return { lo, hi };
  };
  widenForMinWidth(deepestFirst(groups).map((g) => {
    const cols = g.members.filter((id) => packed.has(id)).map(columnOf);
    return {
      id: g.id,
      ...(g.minWidth !== undefined ? { minWidth: g.minWidth } : {}),
      inset: rankInset(g.inset, axes),
      children: children.get(g.id) ?? [],
      before: cols.length === 0 ? -1 : Math.min(...cols) - 1,
      after: cols.length === 0 ? -1 : Math.max(...cols),
    };
  }), gaps, span);
  return gaps;
}

/** A group as {@link widenForMinWidth} reads it. */
export interface MinWidthGroup {
  id: string;
  minWidth?: number;
  /** Its box's inset before and after along the rank. */
  inset: { lo: number; hi: number };
  /** The groups nested directly in it. */
  children: readonly string[];
  /** The index in the gaps of the gap before its first member and after its
   *  last; one out of range has no gap to widen. */
  before: number;
  after: number;
}

/**
 * Widen `gaps` in place so each group's box reaches its `minWidth`, half the
 * shortfall either side, with the box drawn as `boxAround` draws it: what its
 * members span, its children's boxes, grown by its inset, then widened evenly.
 * `groups` runs deepest first, so a box sees its children already widened.
 * `span` is where a group's members start and end along the rank at the gaps
 * as they stand; `lo > hi` for a group with none placed.
 */
export function widenForMinWidth(
  groups: readonly MinWidthGroup[],
  gaps: number[],
  span: (id: string, gaps: readonly number[]) => { lo: number; hi: number },
): void {
  const byId = new Map(groups.map((g) => [g.id, g]));
  const boxOf = (g: MinWidthGroup, minWidth: number): { lo: number; hi: number } => {
    let { lo, hi } = span(g.id, gaps);
    [lo, hi] = [lo - g.inset.lo, hi + g.inset.hi];
    for (const id of g.children) {
      const child = byId.get(id);
      if (child === undefined) continue;
      const box = boxOf(child, child.minWidth ?? 0);
      [lo, hi] = [Math.min(lo, box.lo - g.inset.lo), Math.max(hi, box.hi + g.inset.hi)];
    }
    const grow = Math.max(0, minWidth - (hi - lo)) / 2;
    return { lo: lo - grow, hi: hi + grow };
  };
  for (const g of groups) {
    if (g.minWidth === undefined) continue;
    const box = boxOf(g, 0);
    if (!(box.lo <= box.hi)) continue;
    const half = Math.max(0, g.minWidth - (box.hi - box.lo)) / 2;
    if (g.before >= 0 && g.before < gaps.length) gaps[g.before]! += half;
    if (g.after >= 0 && g.after < gaps.length) gaps[g.after]! += half;
  }
}
