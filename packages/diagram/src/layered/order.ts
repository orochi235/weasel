/**
 * Order: reorder each rank to cut crossings, with barycenter sweeps and
 * transposition, keeping every group's members contiguous in each rank.
 */
import type { GraphGroup, GraphNode } from '../graph';
import { placeAmong, sidesOf, type Sides } from './places';
import type { Hop, Rows } from './types';

/** A hop as ordering reads it: its ends, and where on each it meets them. */
interface Pair {
  from: string;
  to: string;
  fromAt: number;
  toAt: number;
  fromPlaces?: readonly number[] | undefined;
  toPlaces?: readonly number[] | undefined;
}

/** Where a hop meets `from` and `to` with each in its current position. */
function ends(p: Pair, pos: ReadonlyMap<string, number>, sides: Sides): [number, number] {
  const fa = p.fromPlaces === undefined ? p.fromAt : placeAmong(p.fromPlaces, p.to, sides.down.get(p.from) ?? [], pos);
  const fb = p.toPlaces === undefined ? p.toAt : placeAmong(p.toPlaces, p.from, sides.up.get(p.to) ?? [], pos);
  return [at(pos.get(p.from)!, fa), at(pos.get(p.to)!, fb)];
}

/** Where a hop meets a node, as a position in its rank: past every node before
 *  it, and inside its own node's slot by where the port sits. */
const at = (pos: number, frac: number): number => pos + 0.25 + frac / 2;

/** Hops grouped by the rank of their `from` end, as id pairs with their port
 *  places. Hops that do not join a rank to the next are left out. */
function hopsByRank(rows: Rows, hops: readonly Hop[]): Pair[][] {
  const rank = new Map<string, number>();
  rows.forEach((row, r) => row.forEach((n) => rank.set(n.id, r)));
  const out: Pair[][] = rows.map(() => []);
  for (const h of hops) {
    const r = rank.get(h.from);
    if (r !== undefined && rank.get(h.to) === r + 1) {
      out[r]!.push({ from: h.from, to: h.to, fromAt: h.fromAt ?? 0.5, toAt: h.toAt ?? 0.5, fromPlaces: h.fromPlaces, toPlaces: h.toPlaces });
    }
  }
  return out;
}

function positions(rows: Rows): Map<string, number> {
  const pos = new Map<string, number>();
  for (const row of rows) row.forEach((n, i) => pos.set(n.id, i));
  return pos;
}

/** Crossings among one rank pair's hops: sort by upper end, then count the
 *  lower ends already seen that lie strictly beyond each one. */
function pairCrossings(pairs: readonly Pair[], pos: ReadonlyMap<string, number>, sides: Sides): number {
  const met = pairs.map((p) => ends(p, pos, sides)).sort((p, q) => p[0] - q[0] || p[1] - q[1]);
  const lows = [...new Set(met.map(([, b]) => b))].sort((p, q) => p - q);
  const slot = new Map(lows.map((b, i) => [b, i]));
  const width = lows.length;
  const tree = new Array<number>(width + 1).fill(0);
  let seen = 0;
  let count = 0;
  for (const [, end] of met) {
    const b = slot.get(end)!;
    let atMost = 0;
    for (let i = b + 1; i > 0; i -= i & -i) atMost += tree[i]!;
    count += seen - atMost;
    for (let i = b + 1; i <= width; i += i & -i) tree[i]!++;
    seen++;
  }
  return count;
}

function total(rows: Rows, byRank: readonly Pair[][], pos: ReadonlyMap<string, number>, sides: Sides): number {
  let sum = 0;
  for (let r = 0; r + 1 < rows.length; r++) sum += pairCrossings(byRank[r]!, pos, sides);
  return sum;
}

/** Crossings between each pair of adjacent ranks, summed. Two hops cross when
 *  their upper ends and their lower ends sit in opposite orders, reading each
 *  end at its port; hops meeting at one port never cross. */
export function crossings(rows: Rows, hops: readonly Hop[]): number {
  return total(rows, hopsByRank(rows, hops), positions(rows), sidesOf(hops));
}

/** How {@link orderRows} keeps groups together and when it stops. */
export interface OrderOptions {
  /** Groups as the graph has them, for keeping members together. */
  groups?: readonly GraphGroup[];
  /** Sweeps in a row without improvement before stopping. Default 4. */
  patience?: number;
  /** Hard cap on sweeps. Default 24. */
  maxSweeps?: number;
}

/** A group's chain of enclosing groups, outermost first, ending with itself. */
function chainsOf(groups: readonly GraphGroup[]): (group: string | undefined) => readonly string[] {
  const parent = new Map(groups.map((g) => [g.id, g.parent]));
  const cache = new Map<string, string[]>();
  const chain = (id: string, seen: Set<string>): string[] => {
    const known = cache.get(id);
    if (known !== undefined) return known;
    const up = parent.get(id);
    seen.add(id);
    const out = up === undefined || seen.has(up) ? [id] : [...chain(up, seen), id];
    cache.set(id, out);
    return out;
  };
  return (group) => (group === undefined ? [] : chain(group, new Set()));
}

interface Block {
  group?: string;
  items: (GraphNode | Block)[];
  sub: Map<string, Block>;
  sum: number;
  count: number;
  first: number;
}

const newBlock = (first: number, group?: string): Block => ({
  ...(group !== undefined ? { group } : {}), items: [], sub: new Map(), sum: 0, count: 0, first,
});

/** Each ordered group's direct members by their place in its order. */
function placesOf(groups: readonly GraphGroup[]): Map<string, Map<string, number>> {
  return new Map(groups.filter((g) => g.ordered !== undefined).map((g) => [g.id, new Map(g.ordered!.map((m, i) => [m, i]))]));
}

/**
 * One rank sorted by `key`, with each group sorted as one block keyed by the
 * mean of its members' keys, recursively. Ties keep the current order. Inside
 * an ordered group, its members keep the group's order instead.
 */
function sortRank(
  row: readonly GraphNode[],
  key: (n: GraphNode, i: number) => number,
  chainOf: (group: string | undefined) => readonly string[],
  places: ReadonlyMap<string, ReadonlyMap<string, number>> = new Map(),
): GraphNode[] {
  const root = newBlock(0);
  const keyOf = new Map<GraphNode | Block, number>();
  const firstOf = new Map<GraphNode | Block, number>();
  row.forEach((n, i) => {
    const k = key(n, i);
    let at = root;
    for (const g of chainOf(n.group)) {
      let next = at.sub.get(g);
      if (next === undefined) {
        next = newBlock(i, g);
        at.sub.set(g, next);
        at.items.push(next);
      }
      next.sum += k;
      next.count++;
      at = next;
    }
    at.items.push(n);
    keyOf.set(n, k);
    firstOf.set(n, i);
  });
  const out: GraphNode[] = [];
  const flatten = (block: Block) => {
    const place = block.group === undefined ? undefined : places.get(block.group);
    const items = block.items.map((item) => {
      if (place !== undefined) {
        const k = place.get('id' in item ? item.id : item.group!) ?? Infinity;
        return { item, k, first: 'id' in item ? firstOf.get(item)! : item.first };
      }
      if ('id' in item) return { item, k: keyOf.get(item)!, first: firstOf.get(item)! };
      return { item, k: item.sum / item.count, first: item.first };
    });
    items.sort((a, b) => a.k - b.k || a.first - b.first);
    for (const { item } of items) {
      if ('id' in item) out.push(item);
      else flatten(item);
    }
  };
  flatten(root);
  return out;
}

/** A node's neighbor through one hop, where on that neighbor the hop lands,
 *  and, for a port of several places, every place it may land and the side
 *  of the neighbor the hop leaves by. */
interface Near {
  id: string;
  frac: number;
  places?: readonly number[] | undefined;
  side: 'down' | 'up';
}

/** Where on `near` the hop from `self` lands. */
function landing(near: Near, self: string, work: Pick<Work, 'pos' | 'sides'>): number {
  const frac = near.places === undefined ? near.frac : placeAmong(near.places, self, work.sides[near.side].get(near.id) ?? [], work.pos);
  return at(work.pos.get(near.id)!, frac);
}

interface Work {
  rows: GraphNode[][];
  pos: Map<string, number>;
  ups: Map<string, Near[]>;
  downs: Map<string, Near[]>;
  sides: Sides;
  chainOf: (group: string | undefined) => readonly string[];
  places: ReadonlyMap<string, ReadonlyMap<string, number>>;
}

function reindex(work: Work, r: number): void {
  work.rows[r]!.forEach((n, i) => work.pos.set(n.id, i));
}

/** Sort rank `r` by the mean position of the ports its hops land on through
 *  `side`. */
function reorder(work: Work, r: number, side: Map<string, Near[]>): void {
  const key = (n: GraphNode, i: number) => {
    const near = side.get(n.id);
    if (near === undefined || near.length === 0) return i;
    // Less a half, so a port at its node's middle keys at the node's index.
    return near.reduce((s, m) => s + landing(m, n.id, work) - 0.5, 0) / near.length;
  };
  work.rows[r] = sortRank(work.rows[r]!, key, work.chainOf, work.places);
  reindex(work, r);
}

/** Crossings among hops of `u` and of `v` on one side, with `u` before `v`
 *  in `work.pos`. */
function between(work: Work, side: Map<string, Near[]>, u: string, v: string): number {
  const nu = side.get(u);
  const nv = side.get(v);
  if (nu === undefined || nv === undefined) return 0;
  let n = 0;
  for (const a of nu) for (const b of nv) if (landing(a, u, work) > landing(b, v, work)) n++;
  return n;
}

/** Swap neighbors with the same innermost group while that strictly lowers
 *  crossings with both adjacent ranks, until no swap helps. A port of several
 *  places is read for the order each side of the swap gives it. */
function transpose(work: Work): void {
  const { rows, pos, ups, downs } = work;
  const cost = (a: string, b: string) => between(work, ups, a, b) + between(work, downs, a, b);
  let improved = true;
  while (improved) {
    improved = false;
    for (const row of rows) {
      for (let i = 0; i + 1 < row.length; i++) {
        const u = row[i]!;
        const v = row[i + 1]!;
        if (u.group !== v.group || (u.group !== undefined && work.places.has(u.group))) continue;
        const now = cost(u.id, v.id);
        pos.set(v.id, i);
        pos.set(u.id, i + 1);
        if (cost(v.id, u.id) < now) {
          row[i] = v;
          row[i + 1] = u;
          improved = true;
        } else {
          pos.set(u.id, i);
          pos.set(v.id, i + 1);
        }
      }
    }
  }
}

/**
 * The order with the fewest crossings found, starting from `rows`' own order.
 *
 * Sweeps alternate down (each rank keyed by its upper neighbors) and up (by
 * its lower ones), each followed by transposition. Every group's members in
 * a rank stay contiguous, nested groups inside their parent's run; a seed
 * that splits a group is made contiguous before anything is counted. The
 * input is not mutated, and equal input gives equal output.
 */
export function orderRows(rows: Rows, hops: readonly Hop[], opts: OrderOptions = {}): Rows {
  const patience = opts.patience ?? 4;
  const maxSweeps = opts.maxSweeps ?? 24;
  const chainOf = chainsOf(opts.groups ?? []);
  const places = placesOf(opts.groups ?? []);
  const byRank = hopsByRank(rows, hops);
  const ups = new Map<string, Near[]>();
  const downs = new Map<string, Near[]>();
  for (const pairs of byRank) {
    for (const p of pairs) {
      (downs.get(p.from) ?? downs.set(p.from, []).get(p.from)!).push({ id: p.to, frac: p.toAt, places: p.toPlaces, side: 'up' });
      (ups.get(p.to) ?? ups.set(p.to, []).get(p.to)!).push({ id: p.from, frac: p.fromAt, places: p.fromPlaces, side: 'down' });
    }
  }
  const seeded = rows.map((row) => sortRank(row, (_, i) => i, chainOf, places));
  const sides = sidesOf(hops);
  const work: Work = { rows: seeded, pos: positions(seeded), ups, downs, sides, chainOf, places };

  let best = seeded.map((row) => [...row]);
  let fewest = total(work.rows, byRank, work.pos, sides);
  for (let sweep = 0, stale = 0; sweep < maxSweeps && stale < patience && fewest > 0; sweep++) {
    if (sweep % 2 === 0) for (let r = 1; r < work.rows.length; r++) reorder(work, r, ups);
    else for (let r = work.rows.length - 2; r >= 0; r--) reorder(work, r, downs);
    transpose(work);
    const n = total(work.rows, byRank, work.pos, sides);
    if (n < fewest) {
      fewest = n;
      best = work.rows.map((row) => [...row]);
      stale = 0;
    } else stale++;
  }
  return best;
}
