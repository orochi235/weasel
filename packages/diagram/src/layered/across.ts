/**
 * Every rank laid out across again around the pins held so far. A group's
 * column (see `packClusters`) moves as one through every rank it spans, so
 * keeping clear of a pin never slides an outsider into a group's box or a
 * member out of it. A column holding a pin goes where its first pin puts it,
 * and widens to take in any other.
 */
import type { Graph, GraphGroup } from '../graph';
import { extent, type LayoutAxes } from '../layout';
import { crossInset } from '../cluster';
import type { Rows } from './types';

/** What {@link settleAcross} reads. */
export interface AcrossInput {
  graph: Graph;
  rows: Rows;
  /** Each node's low corner across the rank with no pins held. */
  preferred: ReadonlyMap<string, number>;
  /** The low corner across of each pin held. */
  held: ReadonlyMap<string, number>;
  axes: LayoutAxes;
  nodeGap: number;
}

/** A node, or a group's column, as it sits side by side with others. */
interface Item {
  /** Its low edge across, with its group's inset, when nothing is held. */
  pref: number;
  width: number;
  /** Where its low edge must go, when it holds a pin. */
  fixed?: number;
  /** The group whose column it is, if it is one. */
  group?: GraphGroup;
  /** The nodes it carries. */
  members: string[];
  /** Whether it spans more than one rank. */
  tall: boolean;
}

/** What every level of {@link settleAcross} shares. */
interface Context {
  input: AcrossInput;
  groups: ReadonlyMap<string, GraphGroup>;
  rankOf: ReadonlyMap<string, number>;
  sizes: ReadonlyMap<string, number>;
  /** The groups each node is in, outermost first. */
  chains: ReadonlyMap<string, readonly GraphGroup[]>;
}

const EPS = 1e-6;

/**
 * Each node's low corner across, or `undefined` when the held pins leave
 * something nowhere to go: a column too wide for the room between two pins, or
 * a group's box over a pin it does not hold.
 */
export function settleAcross(input: AcrossInput): Map<string, number> | undefined {
  const { graph, rows, axes } = input;
  const groups = new Map((graph.groups ?? []).map((g) => [g.id, g]));
  const rankOf = new Map<string, number>();
  const sizes = new Map<string, number>();
  const chains = new Map<string, GraphGroup[]>();
  for (const [r, row] of rows.entries()) {
    for (const node of row) {
      rankOf.set(node.id, r);
      sizes.set(node.id, extent(node.bounds, axes.cross));
      const chain: GraphGroup[] = [];
      for (let g = node.group === undefined ? undefined : groups.get(node.group); g !== undefined; g = g.parent === undefined ? undefined : groups.get(g.parent)) chain.unshift(g);
      chains.set(node.id, chain);
    }
  }
  const ctx: Context = { input, groups, rankOf, sizes, chains };
  const out = new Map(input.preferred);
  return settleLevel(ctx, [...rankOf.keys()], 0, input.preferred, out) ? out : undefined;
}

/**
 * Lay `ids`, the nodes inside one group (or all of them, at `depth` 0), out
 * across around the pins among them, writing into `out`. A column holding a
 * pin moves as one to put its first pin in place, and is laid out inside the
 * same way, so a second pin elsewhere widens it.
 */
function settleLevel(ctx: Context, ids: readonly string[], depth: number, pref: ReadonlyMap<string, number>, out: Map<string, number>): boolean {
  const { held, nodeGap: gap } = ctx.input;
  const { items, byRank } = itemsAt(ctx, ids, depth, pref);
  for (const item of items) {
    const pin = item.members.find((id) => held.has(id));
    if (pin === undefined) continue;
    if (item.group === undefined) {
      item.fixed = held.get(pin)!;
      continue;
    }
    const shift = held.get(pin)! - pref.get(pin)!;
    const shifted = new Map(pref);
    for (const id of item.members) shifted.set(id, pref.get(id)! + shift);
    if (!settleLevel(ctx, item.members, depth + 1, shifted, out)) return false;
    Object.assign(item, spanOf(ctx, item.group, item.members, out));
    item.fixed = item.pref;
  }
  const xs = items.map((it) => it.fixed ?? it.pref);
  const order = byRank.map((list) => [...list].sort((p, q) => xs[p]! + items[p]!.width / 2 - (xs[q]! + items[q]!.width / 2) || p - q));
  squeeze(items, order, xs, gap);
  for (const list of order) {
    if (clear(items, list, xs, gap)) continue;
    if (list.some((i) => items[i]!.fixed === undefined && items[i]!.tall)) return false;
    jump(items, list, xs, gap);
    if (!clear(items, list, xs, gap)) return false;
  }
  for (const [i, item] of items.entries()) {
    if (item.fixed !== undefined && item.group !== undefined) continue;
    for (const id of item.members) out.set(id, item.fixed !== undefined ? item.fixed : pref.get(id)! + xs[i]! - item.pref);
  }
  return true;
}

/** Pushed clear of what comes before, then pulled clear of what comes after,
 *  past every held item's far edge rather than only the neighbor's. A column
 *  takes the furthest any of its ranks asks for, so repeat until none moves. */
function squeeze(items: readonly Item[], order: readonly number[][], xs: number[], gap: number): void {
  const free = (i: number) => items[i]!.fixed === undefined;
  for (let moved = true, pass = 0; moved && pass <= items.length; pass++) {
    moved = false;
    for (const list of order) {
      let edge = -Infinity;
      for (const i of list) {
        if (free(i) && xs[i]! < edge - EPS) [xs[i], moved] = [edge, true];
        edge = Math.max(edge, xs[i]! + items[i]!.width + gap);
      }
    }
  }
  for (let moved = true, pass = 0; moved && pass <= items.length; pass++) {
    moved = false;
    for (const list of order) {
      let edge = Infinity;
      for (const i of [...list].reverse()) {
        const most = edge - items[i]!.width - gap;
        if (free(i) && xs[i]! > most + EPS) [xs[i], moved] = [most, true];
        edge = Math.min(edge, xs[i]!);
      }
    }
  }
}

/** The items side by side in each rank among `ids`: a node directly at this
 *  level, or the column of a group directly in it, reserved in every rank
 *  from that group's first member's to its last. */
function itemsAt(ctx: Context, ids: readonly string[], depth: number, pref: ReadonlyMap<string, number>): { items: Item[]; byRank: number[][] } {
  const items: Item[] = [];
  const byKey = new Map<string, number>();
  const ranks: [number, number][] = [];
  for (const id of ids) {
    const group = ctx.chains.get(id)![depth];
    const key = group?.id ?? `\u0000node:${id}`;
    const r = ctx.rankOf.get(id)!;
    let i = byKey.get(key);
    if (i === undefined) {
      i = items.length;
      byKey.set(key, i);
      items.push({ pref: 0, width: 0, members: [], tall: false, ...(group !== undefined ? { group } : {}) });
      ranks.push([r, r]);
    }
    items[i]!.members.push(id);
    ranks[i] = [Math.min(ranks[i]![0], r), Math.max(ranks[i]![1], r)];
  }
  for (const [i, item] of items.entries()) {
    Object.assign(item, spanOf(ctx, item.group, item.members, pref));
    item.tall = ranks[i]![0] !== ranks[i]![1];
  }
  const byRank: number[][] = ctx.input.rows.map(() => []);
  for (const [i, [lo, hi]] of ranks.entries()) for (let r = lo; r <= hi; r++) byRank[r]!.push(i);
  return { items, byRank };
}

/** Where `members` reach across at `at`, with `group`'s room around them. */
function spanOf(ctx: Context, group: GraphGroup | undefined, members: readonly string[], at: ReadonlyMap<string, number>): { pref: number; width: number } {
  const lo = Math.min(...members.map((id) => at.get(id)!));
  const hi = Math.max(...members.map((id) => at.get(id)! + ctx.sizes.get(id)!));
  const pad = group === undefined ? { lo: 0, hi: 0 } : padOf(group, ctx.groups, ctx.input.axes);
  return { pref: lo - pad.lo, width: hi - lo + pad.lo + pad.hi };
}

/** The room a group's box keeps across beyond its members on each side,
 *  through the deepest group nested in it on that side. */
function padOf(group: GraphGroup, groups: ReadonlyMap<string, GraphGroup>, axes: LayoutAxes): { lo: number; hi: number } {
  const own = crossInset(group.inset, axes);
  let lo = 0;
  let hi = 0;
  for (const child of groups.values()) {
    if (child.parent !== group.id) continue;
    const pad = padOf(child, groups, axes);
    lo = Math.max(lo, pad.lo);
    hi = Math.max(hi, pad.hi);
  }
  return { lo: own.lo + lo, hi: own.hi + hi };
}

/** Whether every two items in a rank, two pins aside, sit `gap` apart. Two
 *  pins may overlap across when they sit at different depths; a column may
 *  not overlap a pin, which would put the pin in its box. */
function clear(items: readonly Item[], list: readonly number[], xs: readonly number[], gap: number): boolean {
  for (const [k, i] of list.entries()) {
    for (const j of list.slice(k + 1)) {
      const pin = (k: number) => items[k]!.fixed !== undefined && items[k]!.group === undefined;
      if (pin(i) && pin(j)) continue;
      const apart = xs[j]! >= xs[i]! + items[i]!.width + gap - EPS || xs[i]! >= xs[j]! + items[j]!.width + gap - EPS;
      if (!apart) return false;
    }
  }
  return true;
}

/**
 * A rank's free nodes, in order, each at its preferred place or the first
 * clear one past it, jumping a held item it lands on: toward the high end or
 * the low, whichever moves them less in all. Writes into `xs`.
 */
function jump(items: readonly Item[], list: readonly number[], xs: number[], gap: number): void {
  const blocks = list.filter((i) => items[i]!.fixed !== undefined).map((i) => ({ lo: xs[i]! - gap, hi: xs[i]! + items[i]!.width + gap }));
  const free = list.filter((i) => items[i]!.fixed === undefined);
  const along = (dir: 1 | -1): number[] => {
    const out: number[] = [];
    let cursor = dir * -Infinity;
    for (const i of dir === 1 ? free : [...free].reverse()) {
      const width = items[i]!.width;
      let x = dir === 1 ? Math.max(items[i]!.pref, cursor) : Math.min(items[i]!.pref, cursor - width);
      for (let moved = true; moved; ) {
        moved = false;
        for (const b of blocks) {
          if (x < b.hi - EPS && x + width > b.lo + EPS) [x, moved] = [dir === 1 ? b.hi : b.lo - width, true];
        }
      }
      out[i] = x;
      cursor = dir === 1 ? x + width + gap : x - gap;
    }
    return out;
  };
  const cost = (ys: number[]) => free.reduce((sum, i) => sum + Math.abs(ys[i]! - items[i]!.pref), 0);
  const up = along(1);
  const down = along(-1);
  const best = cost(up) <= cost(down) ? up : down;
  for (const i of free) xs[i] = best[i]!;
}
