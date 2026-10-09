/**
 * Clusters: keeping a group's members together through a ranked layout.
 *
 * A group's box is the union of its members plus an inset, so the layout's job
 * is to leave a rectangle for it that nothing else enters. Each group gets a
 * **column** on the cross axis, reserved in every rank from its first member's
 * to its last — including a rank in between that holds none of its members, or
 * an outsider would land inside the box there. Groups keep one cross position
 * across every rank, so two groups' columns never cross and their boxes never
 * overlap. Ungrouped nodes pack around the columns rank by rank, as before.
 *
 * Groups are flat: a group is not a member of another group.
 */
import type { Graph, GraphEdge, GraphGroup, GraphNode } from './graph';
import { extent, type LayoutAxes } from './layout';

/** Room a group's box keeps around its members, in world units. */
export interface GroupInset {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

/** A `DiagramGroup.inset` as all four sides. Default 12 on every side. */
export function insetOf(inset: number | Partial<GroupInset> | undefined): GroupInset {
  if (typeof inset === 'number') return { top: inset, right: inset, bottom: inset, left: inset };
  return {
    top: inset?.top ?? DEFAULT_GROUP_INSET,
    right: inset?.right ?? DEFAULT_GROUP_INSET,
    bottom: inset?.bottom ?? DEFAULT_GROUP_INSET,
    left: inset?.left ?? DEFAULT_GROUP_INSET,
  };
}

/** `DiagramGroup.inset`'s default on each side, in world units. */
export const DEFAULT_GROUP_INSET = 12;

/** A group's inset turned into the canonical frame a layout works in. */
interface CanonicalInset {
  crossLo: number;
  crossHi: number;
  rankLo: number;
  rankHi: number;
}

function canonical(inset: GroupInset, axes: LayoutAxes): CanonicalInset {
  if (axes.rank === 'y') {
    return axes.sign === 1
      ? { crossLo: inset.left, crossHi: inset.right, rankLo: inset.top, rankHi: inset.bottom }
      : { crossLo: inset.left, crossHi: inset.right, rankLo: inset.bottom, rankHi: inset.top };
  }
  return axes.sign === 1
    ? { crossLo: inset.top, crossHi: inset.bottom, rankLo: inset.left, rankHi: inset.right }
    : { crossLo: inset.top, crossHi: inset.bottom, rankLo: inset.right, rankHi: inset.left };
}

/**
 * The gap between each rank and the next, widened so a group's box fits: the
 * widest inset of a group ending at rank `i` and of one starting at `i + 1`
 * both come on top of `rankGap`, since those two boxes can face each other
 * across it. `rows` is the nodes of each rank.
 */
export function rankGaps(
  graph: Graph,
  rows: readonly (readonly GraphNode[])[],
  axes: LayoutAxes,
  rankGap: number,
): number[] {
  const gaps = rows.slice(1).map(() => rankGap);
  const ends = new Map<number, number>();
  const starts = new Map<number, number>();
  for (const span of groupSpans(graph, rows)) {
    const inset = canonical(span.group.inset, axes);
    ends.set(span.hi, Math.max(ends.get(span.hi) ?? 0, inset.rankHi));
    starts.set(span.lo, Math.max(starts.get(span.lo) ?? 0, inset.rankLo));
  }
  for (let i = 0; i < gaps.length; i++) {
    gaps[i] = Math.max(gaps[i]!, rankGap + (ends.get(i) ?? 0) + (starts.get(i + 1) ?? 0));
  }
  return gaps;
}

interface Span {
  group: GraphGroup;
  lo: number;
  hi: number;
}

function groupSpans(graph: Graph, rows: readonly (readonly GraphNode[])[]): Span[] {
  const rankOf = new Map<string, number>();
  rows.forEach((row, i) => row.forEach((n) => rankOf.set(n.id, i)));
  const spans: Span[] = [];
  for (const group of graph.groups ?? []) {
    const ranks = group.members.map((id) => rankOf.get(id)).filter((r): r is number => r !== undefined);
    if (ranks.length === 0) continue;
    spans.push({ group, lo: Math.min(...ranks), hi: Math.max(...ranks) });
  }
  return spans;
}

type Item =
  | { kind: 'node'; node: GraphNode; center: number }
  | { kind: 'group'; span: Span; members: GraphNode[]; center: number };

/**
 * Cross positions for every node, with each group's members kept in a column
 * of their own. `preferred` is where the layout would put each node's low
 * corner with no groups at all; nodes and columns keep that order and are only
 * ever pushed toward the high end, by as much as it takes to stop overlapping.
 */
export function packClusters(
  graph: Graph,
  rows: readonly (readonly GraphNode[])[],
  preferred: ReadonlyMap<string, number>,
  axes: LayoutAxes,
  nodeGap: number,
): Map<string, number> {
  const spans = groupSpans(graph, rows);
  const spanOf = new Map<string, Span>();
  for (const span of spans) for (const id of span.group.members) spanOf.set(id, span);
  const width = (n: GraphNode) => extent(n.bounds, axes.cross);
  const pref = (n: GraphNode) => preferred.get(n.id) ?? 0;
  const packedWidth = (ns: readonly GraphNode[]) =>
    ns.reduce((s, n) => s + width(n), 0) + Math.max(0, ns.length - 1) * nodeGap;

  const insets = new Map(spans.map((s) => [s, canonical(s.group.inset, axes)]));
  const inner = new Map<Span, number>();
  const centerOf = new Map<Span, number>();
  for (const span of spans) {
    let widest = 0;
    let sum = 0;
    let count = 0;
    for (const row of rows) {
      const members = row.filter((n) => spanOf.get(n.id) === span);
      widest = Math.max(widest, packedWidth(members));
      for (const n of members) {
        sum += pref(n) + width(n) / 2;
        count++;
      }
    }
    inner.set(span, widest);
    centerOf.set(span, count === 0 ? 0 : sum / count);
  }
  const outer = (span: Span) => inner.get(span)! + insets.get(span)!.crossLo + insets.get(span)!.crossHi;

  const itemsByRow = rows.map((row, r) => {
    const items: Item[] = [];
    for (const node of row) {
      if (!spanOf.has(node.id)) items.push({ kind: 'node', node, center: pref(node) + width(node) / 2 });
    }
    for (const span of spans) {
      if (r < span.lo || r > span.hi) continue;
      items.push({
        kind: 'group',
        span,
        members: row.filter((n) => spanOf.get(n.id) === span),
        center: centerOf.get(span)!,
      });
    }
    // Stable, so equal centers keep the order the layout gave them.
    return items.map((item, i) => ({ item, i }))
      .sort((a, b) => a.item.center - b.item.center || a.i - b.i)
      .map(({ item }) => item);
  });

  const start = new Map<Span, number>(spans.map((s) => [s, centerOf.get(s)! - outer(s) / 2]));
  const at = new Map<string, number>();
  // Each pass only ever raises a column's start, and a column is raised only
  // by what precedes it in some rank; the order is the same in every rank, so
  // this settles in at most one pass per group.
  for (let pass = 0; pass <= spans.length; pass++) {
    let raised = false;
    for (const items of itemsByRow) {
      let cursor = -Infinity;
      for (const item of items) {
        if (item.kind === 'node') {
          const x = Math.max(pref(item.node), cursor);
          at.set(item.node.id, x);
          cursor = x + width(item.node) + nodeGap;
          continue;
        }
        const s = start.get(item.span)!;
        const x = Math.max(s, cursor);
        if (x > s) {
          start.set(item.span, x);
          raised = true;
        }
        const inset = insets.get(item.span)!;
        let m = x + inset.crossLo + (inner.get(item.span)! - packedWidth(item.members)) / 2;
        for (const node of item.members) {
          at.set(node.id, m);
          m += width(node) + nodeGap;
        }
        cursor = x + outer(item.span) + nodeGap;
      }
    }
    if (!raised) break;
  }
  return at;
}

/**
 * Edges as a layout should rank by: one into a group arrives at its entry
 * members — those no other member points at — and one out of it leaves from its
 * exit members. A group with no such member, a pure cycle, is all entries and
 * all exits. An edge between a group and one of its own members, or two
 * members of one group, is a group's internal business and ranks nothing
 * beyond what its member-to-member edges already do.
 */
export function expandGroupEdges(
  edges: readonly GraphEdge[],
  groups: readonly GraphGroup[],
): GraphEdge[] {
  const byId = new Map(groups.map((g) => [g.id, g]));
  if (byId.size === 0) return [...edges];
  const groupOf = new Map<string, string>();
  for (const g of groups) for (const m of g.members) groupOf.set(m, g.id);

  const entries = new Map<string, readonly string[]>();
  const exits = new Map<string, readonly string[]>();
  for (const g of groups) {
    const inside = new Set(g.members);
    const pointedAt = new Set<string>();
    const pointing = new Set<string>();
    for (const e of edges) {
      if (inside.has(e.from) && inside.has(e.to) && e.from !== e.to) {
        pointedAt.add(e.to);
        pointing.add(e.from);
      }
    }
    const entry = g.members.filter((m) => !pointedAt.has(m));
    const exit = g.members.filter((m) => !pointing.has(m));
    entries.set(g.id, entry.length > 0 ? entry : g.members);
    exits.set(g.id, exit.length > 0 ? exit : g.members);
  }

  const out: GraphEdge[] = [];
  for (const e of edges) {
    const fromGroup = byId.has(e.from) ? e.from : undefined;
    const toGroup = byId.has(e.to) ? e.to : undefined;
    if (fromGroup === undefined && toGroup === undefined) {
      out.push(e);
      continue;
    }
    const fromOwner = fromGroup ?? groupOf.get(e.from);
    const toOwner = toGroup ?? groupOf.get(e.to);
    if (fromOwner !== undefined && fromOwner === toOwner) continue;
    const froms = fromGroup !== undefined ? exits.get(fromGroup)! : [e.from];
    const tos = toGroup !== undefined ? entries.get(toGroup)! : [e.to];
    let k = 0;
    for (const from of froms) {
      for (const to of tos) out.push({ id: `${e.id}#${k++}`, from, to });
    }
  }
  return out;
}
