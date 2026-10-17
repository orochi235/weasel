/**
 * Every rank laid out across again around the pins held so far. A group's
 * column (see `packClusters`) moves as one through every rank it spans, so
 * keeping clear of a pin never slides an outsider into a group's box or a
 * member out of it; a column holding a pin goes where that pin puts it.
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
  /** The nodes it carries. */
  members: string[];
  /** Whether it spans more than one rank. */
  tall: boolean;
}

const EPS = 1e-6;

/**
 * Each node's low corner across, or `undefined` when the held pins leave a
 * column nowhere to go: two pins in one column a different distance apart
 * than the column keeps them, or a column too wide for the room between two
 * pins.
 */
export function settleAcross(input: AcrossInput): Map<string, number> | undefined {
  const built = itemsOf(input);
  if (built === undefined) return undefined;
  const { items, byRank } = built;
  const xs = items.map((it) => it.fixed ?? it.pref);
  const order = byRank.map((list) => [...list].sort((p, q) => centerOf(items[p]!, xs[p]!) - centerOf(items[q]!, xs[q]!) || p - q));
  const gap = input.nodeGap;
  const free = (i: number) => items[i]!.fixed === undefined;

  // Pushed clear of what comes before, then pulled clear of what comes after,
  // past every held item's far edge rather than only the neighbor's. A column
  // takes the furthest any of its ranks asks for, so repeat until none moves.
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

  for (const list of order) {
    if (clear(items, list, xs, gap)) continue;
    if (list.some((i) => free(i) && items[i]!.tall)) return undefined;
    jump(items, list, xs, gap);
  }

  const out = new Map(input.preferred);
  for (const [i, item] of items.entries()) {
    for (const id of item.members) out.set(id, input.preferred.get(id)! + xs[i]! - item.pref);
  }
  return out;
}

const centerOf = (item: Item, x: number) => x + item.width / 2;

/** The items side by side in each rank: a node outside every group, or the
 *  column of the outermost group a node is in, reserved in every rank from
 *  that group's first member's to its last. */
function itemsOf(input: AcrossInput): { items: Item[]; byRank: number[][] } | undefined {
  const { graph, rows, preferred, held, axes } = input;
  const groups = new Map((graph.groups ?? []).map((g) => [g.id, g]));
  const rootOf = (id: string | undefined): GraphGroup | undefined => {
    let g = id === undefined ? undefined : groups.get(id);
    while (g?.parent !== undefined && groups.has(g.parent)) g = groups.get(g.parent);
    return g;
  };
  const items: Item[] = [];
  const byKey = new Map<string, number>();
  const ranksOf: [number, number][] = [];
  const sizes = new Map<string, number>();
  for (const [r, row] of rows.entries()) {
    for (const node of row) {
      sizes.set(node.id, extent(node.bounds, axes.cross));
      const key = rootOf(node.group)?.id ?? `\u0000node:${node.id}`;
      let i = byKey.get(key);
      if (i === undefined) {
        i = items.length;
        byKey.set(key, i);
        items.push({ pref: 0, width: 0, members: [], tall: false });
        ranksOf.push([r, r]);
      }
      items[i]!.members.push(node.id);
      ranksOf[i]![1] = r;
      items[i]!.tall = ranksOf[i]![0] !== r;
    }
  }
  for (const [key, i] of byKey) {
    const item = items[i]!;
    const lo = Math.min(...item.members.map((id) => preferred.get(id)!));
    const hi = Math.max(...item.members.map((id) => preferred.get(id)! + sizes.get(id)!));
    const group = groups.get(key);
    const pad = group === undefined ? { lo: 0, hi: 0 } : padOf(group, groups, axes);
    item.pref = lo - pad.lo;
    item.width = hi - lo + pad.lo + pad.hi;
    for (const id of item.members) {
      const at = held.get(id);
      if (at === undefined) continue;
      const fixed = at - (preferred.get(id)! - item.pref);
      if (item.fixed !== undefined && Math.abs(item.fixed - fixed) > EPS) return undefined;
      item.fixed = fixed;
    }
  }
  const byRank: number[][] = rows.map(() => []);
  for (const [i, [lo, hi]] of ranksOf.entries()) for (let r = lo; r <= hi; r++) byRank[r]!.push(i);
  return { items, byRank };
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

/** Whether every two items in a rank, two held ones aside, sit `gap` apart.
 *  Two pins may overlap across when they sit at different depths. */
function clear(items: readonly Item[], list: readonly number[], xs: readonly number[], gap: number): boolean {
  for (const [k, i] of list.entries()) {
    for (const j of list.slice(k + 1)) {
      if (items[i]!.fixed !== undefined && items[j]!.fixed !== undefined) continue;
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
