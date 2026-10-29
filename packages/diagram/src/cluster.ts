/**
 * Clusters: keeping a group's members together through a ranked layout.
 *
 * A group's box is the union of its members plus an inset, so the layout's job
 * is to leave a rectangle for it that nothing else enters. Each group gets a
 * **column** on the cross axis, reserved in every rank from its first member's
 * to its last — including a rank in between that holds none of its members, or
 * an outsider would land inside the box there. Groups keep one cross position
 * across every rank, so two groups' columns never cross and their boxes never
 * overlap. Ungrouped nodes pack around the columns rank by rank.
 *
 * A group may be a member of another: its column then sits inside its parent's.
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

/** The room `inset` keeps on the low and high side across the rank. */
export function crossInset(inset: GroupInset, axes: LayoutAxes): { lo: number; hi: number } {
  const c = canonical(inset, axes);
  return { lo: c.crossLo, hi: c.crossHi };
}

/** The room `inset` keeps before and after along the rank. */
export function rankInset(inset: GroupInset, axes: LayoutAxes): { lo: number; hi: number } {
  const c = canonical(inset, axes);
  return { lo: c.rankLo, hi: c.rankHi };
}

/**
 * The gap between each rank and the next, widened so a group's box fits: the
 * widest inset of a group ending at rank `i` and of one starting at `i + 1`
 * both come on top of `rankGap`, since those two boxes can face each other
 * across it. A group's inset there includes that of any group nested in it
 * that ends, or starts, at the same rank. `rows` is the nodes of each rank.
 */
export function rankGaps(
  graph: Pick<Graph, 'groups'>,
  rows: readonly (readonly Pick<GraphNode, 'id'>[])[],
  axes: LayoutAxes,
  rankGap: number,
): number[] {
  const gaps = rows.slice(1).map(() => rankGap);
  const ends = new Map<number, number>();
  const starts = new Map<number, number>();
  const reach = (span: Span, side: 'lo' | 'hi'): number => {
    const own = canonical(span.group.inset, axes)[side === 'lo' ? 'rankLo' : 'rankHi'];
    const flush = span.children.filter((c) => c[side] === span[side]);
    return own + Math.max(0, ...flush.map((c) => reach(c, side)));
  };
  for (const span of groupSpans(graph, rows)) {
    ends.set(span.hi, Math.max(ends.get(span.hi) ?? 0, reach(span, 'hi')));
    starts.set(span.lo, Math.max(starts.get(span.lo) ?? 0, reach(span, 'lo')));
  }
  for (let i = 0; i < gaps.length; i++) {
    gaps[i] = Math.max(gaps[i]!, rankGap + (ends.get(i) ?? 0) + (starts.get(i + 1) ?? 0));
  }
  return gaps;
}

/** A group as the ranks see it: the ranks it reaches across, and the groups
 *  nested directly in it. */
interface Span {
  group: GraphGroup;
  lo: number;
  hi: number;
  parent?: Span;
  children: Span[];
}

function groupSpans(graph: Pick<Graph, 'groups'>, rows: readonly (readonly Pick<GraphNode, 'id'>[])[]): Span[] {
  const rankOf = new Map<string, number>();
  rows.forEach((row, i) => row.forEach((n) => rankOf.set(n.id, i)));
  const spans: Span[] = [];
  const byId = new Map<string, Span>();
  for (const group of graph.groups ?? []) {
    const ranks = group.members.map((id) => rankOf.get(id)).filter((r): r is number => r !== undefined);
    if (ranks.length === 0) continue;
    const span: Span = { group, lo: Math.min(...ranks), hi: Math.max(...ranks), children: [] };
    spans.push(span);
    byId.set(group.id, span);
  }
  for (const span of spans) {
    const parent = span.group.parent === undefined ? undefined : byId.get(span.group.parent);
    if (parent === undefined) continue;
    span.parent = parent;
    parent.children.push(span);
  }
  return spans;
}

type Item =
  | { kind: 'node'; node: GraphNode; center: number }
  | { kind: 'group'; span: Span; center: number };

/** A group's contents, packed: how wide they are, and where each node and
 *  nested group starts from the group's inner low edge. */
interface Block {
  width: number;
  nodeAt: Map<string, number>;
  childAt: Map<Span, number>;
}

/**
 * Cross positions for every node, with each group's members kept in a column
 * of their own, and a nested group in a column inside its parent's.
 * `preferred` is where the layout would put each node's low corner with no
 * groups at all; nodes and columns keep that order and are only ever pushed
 * toward the high end, by as much as it takes to stop overlapping.
 */
export function packClusters(
  graph: Graph,
  rows: readonly (readonly GraphNode[])[],
  preferred: ReadonlyMap<string, number>,
  axes: LayoutAxes,
  nodeGap: number,
): Map<string, number> {
  const spans = groupSpans(graph, rows);
  const spanById = new Map(spans.map((s) => [s.group.id, s]));
  const spanOf = (n: GraphNode): Span | undefined => (n.group === undefined ? undefined : spanById.get(n.group));
  const width = (n: GraphNode) => extent(n.bounds, axes.cross);
  const pref = (n: GraphNode) => preferred.get(n.id) ?? 0;
  const insets = new Map(spans.map((s) => [s, canonical(s.group.inset, axes)]));

  const centerOf = centersOf(spans, rows, (n) => pref(n) + width(n) / 2);

  /** What sits side by side in each rank at one level: the nodes directly in
   *  `owner` and the groups directly in it, in the order of their centers. */
  const itemsByRow = (owner: Span | undefined, among: readonly Span[]): Item[][] =>
    rows.map((row, r) => {
      const items: Item[] = [];
      for (const node of row) {
        if (spanOf(node) === owner) items.push({ kind: 'node', node, center: pref(node) + width(node) / 2 });
      }
      for (const span of among) {
        if (r >= span.lo && r <= span.hi) items.push({ kind: 'group', span, center: centerOf.get(span)! });
      }
      // Stable, so equal centers keep the order the layout gave them.
      return items.map((item, i) => ({ item, i }))
        .sort((a, b) => a.item.center - b.item.center || a.i - b.i)
        .map(({ item }) => item);
    });

  /**
   * Walk each rank low to high, handing every node `nodeFloor` or the cursor,
   * whichever is higher, and every column its `start` or the cursor. Each pass
   * only ever raises a column's start, and a column is raised only by what
   * precedes it in some rank; the order is the same in every rank, so this
   * settles in at most one pass per column.
   */
  const settle = (
    byRow: readonly Item[][],
    start: Map<Span, number>,
    nodeFloor: (node: GraphNode) => number,
    origin: number,
  ): { nodeAt: Map<string, number>; ends: number[] } => {
    const nodeAt = new Map<string, number>();
    let ends: number[] = [];
    for (let pass = 0; pass <= start.size; pass++) {
      let raised = false;
      ends = byRow.map((items) => {
        let cursor = origin;
        for (const item of items) {
          if (item.kind === 'node') {
            const x = Math.max(nodeFloor(item.node), cursor);
            nodeAt.set(item.node.id, x);
            cursor = x + width(item.node) + nodeGap;
            continue;
          }
          const s = start.get(item.span)!;
          const x = Math.max(s, cursor);
          if (x > s) {
            start.set(item.span, x);
            raised = true;
          }
          cursor = x + outer(item.span) + nodeGap;
        }
        return items.length === 0 ? origin : cursor - nodeGap;
      });
      if (!raised) break;
    }
    return { nodeAt, ends };
  };

  const blocks = new Map<Span, Block>();
  const blockOf = (span: Span): Block => {
    const known = blocks.get(span);
    if (known !== undefined) return known;
    const byRow = itemsByRow(span, span.children);
    // Each node keeps where placement put it, measured from the block's
    // lowest, so the ports a wire joins stay lined up inside a group; nested
    // columns and the gap only push things apart. A stretch no member covers
    // in any rank closes to `nodeGap`, so the box holds no empty room.
    const own = rows.flat().filter((n) => spanOf(n) === span);
    const base = Math.min(...rows.flat().filter((n) => span.group.members.includes(n.id) || spanOf(n) === span).map(pref));
    const childLo = new Map(span.children.map((c) => [c, Math.max(0, centerOf.get(c)! - outer(c) / 2 - base)]));
    const squeezed = closeGaps([
      ...own.map((n) => [pref(n) - base, pref(n) - base + width(n)] as const),
      ...span.children.map((c) => [childLo.get(c)!, childLo.get(c)! + outer(c)] as const),
    ], nodeGap);
    const childAt = new Map<Span, number>(span.children.map((c) => [c, squeezed(childLo.get(c)!)]));
    const { nodeAt, ends } = settle(byRow, childAt, (n) => squeezed(pref(n) - base), 0);
    const block: Block = { width: Math.max(0, ...ends), nodeAt, childAt };
    const slack = widen(block, span.group, insets.get(span)!, axes);
    for (const [id, x] of nodeAt) nodeAt.set(id, x + slack);
    blocks.set(span, block);
    return block;
  };
  function outer(span: Span): number {
    const inset = insets.get(span)!;
    return blockOf(span).width + inset.crossLo + inset.crossHi;
  }

  const roots = spans.filter((s) => s.parent === undefined);
  const start = new Map<Span, number>(roots.map((s) => [s, centerOf.get(s)! - outer(s) / 2]));
  const { nodeAt: at } = settle(itemsByRow(undefined, roots), start, pref, -Infinity);

  const place = (span: Span, from: number): void => {
    const origin = from + insets.get(span)!.crossLo;
    const block = blockOf(span);
    for (const [id, local] of block.nodeAt) at.set(id, origin + local);
    for (const [child, local] of block.childAt) place(child, origin + local);
  };
  for (const root of roots) place(root, start.get(root)!);
  return at;
}

/** Each group's mean member center, where placement put them. */
function centersOf(spans: readonly Span[], rows: readonly (readonly GraphNode[])[], center: (n: GraphNode) => number): Map<Span, number> {
  const out = new Map<Span, number>();
  for (const span of spans) {
    const inside = new Set(span.group.members);
    const centers = rows.flat().filter((n) => inside.has(n.id)).map(center);
    out.set(span, centers.length === 0 ? 0 : centers.reduce((a, b) => a + b, 0) / centers.length);
  }
  return out;
}

/** A map from a block's own coordinates to ones where every stretch that
 *  `spans` leave uncovered is at most `gap` wide, and covered ones keep
 *  their length. */
function closeGaps(spans: readonly (readonly [number, number])[], gap: number): (at: number) => number {
  const sorted = [...spans].sort((a, b) => a[0] - b[0]);
  const cuts: [number, number][] = [];
  let reach = sorted[0]?.[1] ?? 0;
  let removed = 0;
  for (const [lo, hi] of sorted.slice(1)) {
    if (lo - reach > gap) {
      removed += lo - reach - gap;
      cuts.push([lo, removed]);
    }
    reach = Math.max(reach, hi);
  }
  return (at) => {
    let shift = 0;
    for (const [from, by] of cuts) if (at >= from) shift = by;
    return at - shift;
  };
}

/** Widen a block to its group's `minWidth`, centering what it holds, and
 *  answer the room added on each side. A label only runs along world x, so
 *  only a vertical layout widens for it. */
function widen(block: Block, group: GraphGroup, inset: CanonicalInset, axes: LayoutAxes): number {
  const floor = axes.cross === 'x' ? (group.minWidth ?? 0) - inset.crossLo - inset.crossHi : 0;
  const slack = Math.max(0, floor - block.width) / 2;
  block.width += 2 * slack;
  for (const [child, local] of block.childAt) block.childAt.set(child, local + slack);
  return slack;
}

/**
 * Edges as a layout should rank by: one into a group arrives at its entry
 * members — those no other member points at — and one out of it leaves from its
 * exit members. A group with no such member, a pure cycle, is all entries and
 * all exits. An edge between a group and something inside it, a member or a
 * nested group, is that group's internal business and ranks nothing beyond
 * what its member-to-member edges already do.
 */
export function expandGroupEdges(
  edges: readonly GraphEdge[],
  groups: readonly GraphGroup[],
): GraphEdge[] {
  const byId = new Map(groups.map((g) => [g.id, g]));
  if (byId.size === 0) return [...edges];
  /** Whether `id`, a node or a group, is `group` or somewhere inside it. */
  const within = (id: string, group: GraphGroup): boolean => {
    if (!byId.has(id)) return group.members.includes(id);
    for (let at = byId.get(id); at !== undefined; at = at.parent === undefined ? undefined : byId.get(at.parent)) {
      if (at === group) return true;
    }
    return false;
  };

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
    if (fromGroup !== undefined && within(e.to, byId.get(fromGroup)!)) continue;
    if (toGroup !== undefined && within(e.from, byId.get(toGroup)!)) continue;
    const froms = fromGroup !== undefined ? exits.get(fromGroup)! : [e.from];
    const tos = toGroup !== undefined ? entries.get(toGroup)! : [e.to];
    let k = 0;
    // A port names a place on a node, so only a node end keeps its own.
    const ports = {
      ...(fromGroup === undefined && e.fromPort !== undefined ? { fromPort: e.fromPort } : {}),
      ...(toGroup === undefined && e.toPort !== undefined ? { toPort: e.toPort } : {}),
      ...(e.label !== undefined ? { label: e.label } : {}),
      ...(e.waypoints !== undefined ? { waypoints: e.waypoints } : {}),
      ...(e.authored ? { authored: true } : {}),
    };
    for (const from of froms) {
      for (const to of tos) out.push({ id: `${e.id}#${k++}`, from, to, ...ports, origin: { id: e.id, from: e.from, to: e.to } });
    }
  }
  return out;
}
