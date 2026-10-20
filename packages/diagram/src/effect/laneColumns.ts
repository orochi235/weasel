/**
 * Columns for the `lanes` look: which column each stage stands in, and the
 * room between columns, with each group's members holding a run of columns
 * no other stage stands in, so the box drawn around them covers nothing else.
 */
import { widenForMinWidth } from '../chainGroups';
import { DEFAULT_GROUP_INSET, insetOf, rankGaps } from '../cluster';
import type { GraphGroup } from '../graph';
import { nestGroups } from '../groupTree';
import type { DrawableWire } from './draw';
import type { EffectGroup, EffectStage } from './types';

/** A stage's span: the first and last lane it touches. */
export type Span = readonly [number, number];

/** A group's run of columns. */
export interface LaneBlock {
  group: string;
  first: number;
  last: number;
  /** How many groups this one sits inside. */
  depth: number;
  /** The narrowest its box may be: its title's width and an inset either side. */
  minWidth: number;
}

/** One thing a level places: a stage, or a group's members as one block. */
interface Item {
  stages: readonly string[];
  inner?: { width: number; column: Map<string, number>; blocks: LaneBlock[] };
}

/**
 * Each stage's column: right of every stage feeding it, and right again past
 * any column where a stage already holds one of its lanes. On a loop the
 * first stage left in source order goes next. Each top-level group is placed
 * the same way as one stage spanning its members' lanes, laid out inside by
 * the same rule, but it shares none of its columns with anything else.
 * `titles` is each labeled group's title width.
 */
export function laneColumns(
  stages: readonly EffectStage[],
  wires: readonly DrawableWire[],
  spans: ReadonlyMap<string, Span>,
  groups: readonly EffectGroup[],
  titles: ReadonlyMap<string, number> = new Map(),
): { column: Map<string, number>; blocks: LaneBlock[] } {
  const order = new Map(stages.map((s, i) => [s.id, i]));
  const nested = nestGroups(groups, (id) => order.has(id));
  const byId = new Map(nested.map((g) => [g.id, g]));
  const grouped = new Set(nested.flatMap((g) => g.members));
  const first = (id: string) => Math.min(...(byId.get(id)?.members ?? [id]).map((m) => order.get(m)!));
  const itemsOf = (ids: readonly string[], depth: number): Item[] => [...ids].sort((a, b) => first(a) - first(b)).map((id) => {
    const g = byId.get(id);
    if (g === undefined) return { stages: [id] };
    const inside = place(itemsOf(g.direct, depth + 1), wires, spans);
    const minWidth = titles.has(g.id) ? titles.get(g.id)! + 2 * DEFAULT_GROUP_INSET : 0;
    const own: LaneBlock = { group: g.id, first: 0, last: inside.width - 1, depth, minWidth };
    return { stages: g.members, inner: { ...inside, blocks: [own, ...inside.blocks] } };
  });
  const top = [...stages.map((s) => s.id).filter((id) => !grouped.has(id)), ...nested.filter((g) => g.parent === undefined).map((g) => g.id)];
  const { column, blocks } = place(itemsOf(top, 0), wires, spans);
  return { column, blocks };
}

/** One level's items in columns from 0, each block's columns its own. */
function place(items: readonly Item[], wires: readonly DrawableWire[], spans: ReadonlyMap<string, Span>) {
  const owner = new Map<string, number>();
  items.forEach((item, k) => item.stages.forEach((id) => owner.set(id, k)));
  const feeds = items.map(() => new Set<string>());
  for (const { wire: { from, to } } of wires) {
    const [a, b] = [owner.get(from.stage), owner.get(to.stage)];
    if (a !== undefined && b !== undefined && a !== b) feeds[b]!.add(from.stage);
  }
  const column = new Map<string, number>();
  const blocks: LaneBlock[] = [];
  const held: Span[][] = [];
  const whole = new Set<number>();
  const fits = (item: Item, c: number): boolean => {
    if (item.inner === undefined) {
      const span = spans.get(item.stages[0]!)!;
      return !whole.has(c) && !held[c]?.some(([lo, hi]) => lo <= span[1] && span[0] <= hi);
    }
    for (let j = c; j < c + item.inner.width; j++) if (whole.has(j) || (held[j]?.length ?? 0) > 0) return false;
    return true;
  };
  const left = items.map((_, k) => k);
  while (left.length > 0) {
    const i = Math.max(0, left.findIndex((k) => [...feeds[k]!].every((f) => column.has(f))));
    const k = left.splice(i, 1)[0]!;
    const item = items[k]!;
    let c = Math.max(0, ...[...feeds[k]!].flatMap((f) => (column.has(f) ? [column.get(f)! + 1] : [])));
    while (!fits(item, c)) c++;
    if (item.inner === undefined) {
      (held[c] ??= []).push(spans.get(item.stages[0]!)!);
      column.set(item.stages[0]!, c);
      continue;
    }
    for (let j = c; j < c + item.inner.width; j++) whole.add(j);
    for (const [id, at] of item.inner.column) column.set(id, c + at);
    for (const b of item.inner.blocks) blocks.push({ ...b, first: b.first + c, last: b.last + c });
  }
  return { width: Math.max(0, ...column.values()) + (column.size > 0 ? 1 : 0), column, blocks };
}

/**
 * Each column's left edge, from `start`, and where the last one's room ends.
 * Columns stand `gap` apart, and further at a block's edge by an inset for
 * each block flush there, as a layered layout's ranks do. A block whose box
 * would fall short of its `minWidth` widens the room either side of it
 * evenly. `extent` is where a stage's box starts and ends from its column's
 * left edge.
 */
export function columnLefts(
  widths: readonly (number | undefined)[],
  column: ReadonlyMap<string, number>,
  blocks: readonly LaneBlock[],
  gap: number,
  start: number,
  extent: (id: string) => { lo: number; hi: number },
): { lefts: number[]; end: number } {
  const count = widths.length;
  const room = blockRoom(widths.length, column, blocks, gap);
  const leftsNow = (now: readonly number[]) => {
    let x = start;
    return Array.from(widths, (wd, c) => {
      x += now[c]!;
      const at = x;
      x += wd ?? 0;
      return at;
    });
  };
  const byId = new Map(blocks.map((b) => [b.group, b]));
  const span = (group: string, now: readonly number[]) => {
    const b = byId.get(group)!;
    const lefts = leftsNow(now);
    let [lo, hi] = [Infinity, -Infinity];
    for (const [id, c] of column) {
      if (c >= b.first && c <= b.last) [lo, hi] = [Math.min(lo, lefts[c]! + extent(id).lo), Math.max(hi, lefts[c]! + extent(id).hi)];
    }
    return { lo, hi };
  };
  const inset = { lo: DEFAULT_GROUP_INSET, hi: DEFAULT_GROUP_INSET };
  widenForMinWidth([...blocks].sort((p, q) => q.depth - p.depth).map((b) => ({
    id: b.group,
    minWidth: b.minWidth,
    inset,
    children: blocks.filter((k) => k.depth === b.depth + 1 && k.first >= b.first && k.last <= b.last).map((k) => k.group),
    before: b.first,
    after: b.last + 1,
  })), room, span);
  const lefts = leftsNow(room);
  return { lefts, end: count === 0 ? start : lefts[count - 1]! + (widths[count - 1] ?? 0) + room[count]! };
}

/** The room before each column, and after the last: `rankGaps` over the
 *  columns with an empty one either side, less `gap` at the two ends. */
function blockRoom(count: number, column: ReadonlyMap<string, number>, blocks: readonly LaneBlock[], gap: number): number[] {
  if (blocks.length === 0) return Array.from({ length: count + 1 }, (_, c) => (c === 0 || c === count ? 0 : gap));
  const rows: { id: string }[][] = Array.from({ length: count + 2 }, () => []);
  for (const [id, c] of column) rows[c + 1]!.push({ id });
  const inside = (b: LaneBlock) => [...column].filter(([, c]) => c >= b.first && c <= b.last).map(([id]) => id);
  const groups = blocks.map((b): GraphGroup => {
    const parent = blocks.find((p) => p.depth === b.depth - 1 && p.first <= b.first && b.last <= p.last);
    return { id: b.group, members: inside(b), inset: insetOf(DEFAULT_GROUP_INSET), ...(parent !== undefined ? { parent: parent.group } : {}) };
  });
  const gaps = rankGaps({ groups }, rows, { rank: 'x', cross: 'y', sign: 1 }, gap);
  return gaps.map((g, c) => (c === 0 || c === count ? g - gap : g));
}
