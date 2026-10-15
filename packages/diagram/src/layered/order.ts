/**
 * Order: reorder each rank to cut crossings, with barycenter sweeps and
 * transposition, keeping every group's members contiguous in each rank.
 */
import type { GraphGroup, GraphNode } from '../graph';
import type { Hop, Rows } from './types';

type Pair = readonly [from: string, to: string, fromAt: number, toAt: number];

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
    if (r !== undefined && rank.get(h.to) === r + 1) out[r]!.push([h.from, h.to, h.fromAt ?? 0.5, h.toAt ?? 0.5]);
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
function pairCrossings(pairs: readonly Pair[], pos: ReadonlyMap<string, number>): number {
  const ends = pairs.map(([a, b, fa, fb]) => [at(pos.get(a)!, fa), at(pos.get(b)!, fb)] as const)
    .sort((p, q) => p[0] - q[0] || p[1] - q[1]);
  const lows = [...new Set(ends.map(([, b]) => b))].sort((p, q) => p - q);
  const slot = new Map(lows.map((b, i) => [b, i]));
  const width = lows.length;
  const tree = new Array<number>(width + 1).fill(0);
  let seen = 0;
  let count = 0;
  for (const [, end] of ends) {
    const b = slot.get(end)!;
    let atMost = 0;
    for (let i = b + 1; i > 0; i -= i & -i) atMost += tree[i]!;
    count += seen - atMost;
    for (let i = b + 1; i <= width; i += i & -i) tree[i]!++;
    seen++;
  }
  return count;
}

function total(rows: Rows, byRank: readonly Pair[][], pos: ReadonlyMap<string, number>): number {
  let sum = 0;
  for (let r = 0; r + 1 < rows.length; r++) sum += pairCrossings(byRank[r]!, pos);
  return sum;
}

/** Crossings between each pair of adjacent ranks, summed. Two hops cross when
 *  their upper ends and their lower ends sit in opposite orders, reading each
 *  end at its port; hops meeting at one port never cross. */
export function crossings(rows: Rows, hops: readonly Hop[]): number {
  return total(rows, hopsByRank(rows, hops), positions(rows));
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
  items: (GraphNode | Block)[];
  sub: Map<string, Block>;
  sum: number;
  count: number;
  first: number;
}

const newBlock = (first: number): Block => ({ items: [], sub: new Map(), sum: 0, count: 0, first });

/**
 * One rank sorted by `key`, with each group sorted as one block keyed by the
 * mean of its members' keys, recursively. Ties keep the current order.
 */
function sortRank(
  row: readonly GraphNode[],
  key: (n: GraphNode, i: number) => number,
  chainOf: (group: string | undefined) => readonly string[],
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
        next = newBlock(i);
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
    const items = block.items.map((item) => {
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

/** A node's neighbor through one hop, and where on that neighbor the hop
 *  lands. */
interface Near {
  id: string;
  frac: number;
}

interface Work {
  rows: GraphNode[][];
  pos: Map<string, number>;
  ups: Map<string, Near[]>;
  downs: Map<string, Near[]>;
  chainOf: (group: string | undefined) => readonly string[];
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
    return near.reduce((s, m) => s + at(work.pos.get(m.id)!, m.frac) - 0.5, 0) / near.length;
  };
  work.rows[r] = sortRank(work.rows[r]!, key, work.chainOf);
  reindex(work, r);
}

/** Crossings among hops of `u` and of `v` on one side, with `u` before `v`. */
function between(u: readonly Near[] | undefined, v: readonly Near[] | undefined, pos: Map<string, number>): number {
  if (u === undefined || v === undefined) return 0;
  let n = 0;
  for (const a of u) for (const b of v) if (at(pos.get(a.id)!, a.frac) > at(pos.get(b.id)!, b.frac)) n++;
  return n;
}

/** Swap neighbors with the same innermost group while that strictly lowers
 *  crossings with both adjacent ranks, until no swap helps. */
function transpose(work: Work): void {
  const { rows, pos, ups, downs } = work;
  const cost = (a: string, b: string) => between(ups.get(a), ups.get(b), pos) + between(downs.get(a), downs.get(b), pos);
  let improved = true;
  while (improved) {
    improved = false;
    for (const row of rows) {
      for (let i = 0; i + 1 < row.length; i++) {
        const u = row[i]!;
        const v = row[i + 1]!;
        if (u.group !== v.group || cost(v.id, u.id) >= cost(u.id, v.id)) continue;
        row[i] = v;
        row[i + 1] = u;
        pos.set(v.id, i);
        pos.set(u.id, i + 1);
        improved = true;
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
  const byRank = hopsByRank(rows, hops);
  const ups = new Map<string, Near[]>();
  const downs = new Map<string, Near[]>();
  for (const pairs of byRank) {
    for (const [a, b, fa, fb] of pairs) {
      (downs.get(a) ?? downs.set(a, []).get(a)!).push({ id: b, frac: fb });
      (ups.get(b) ?? ups.set(b, []).get(b)!).push({ id: a, frac: fa });
    }
  }
  const seeded = rows.map((row) => sortRank(row, (_, i) => i, chainOf));
  const work: Work = { rows: seeded, pos: positions(seeded), ups, downs, chainOf };

  let best = seeded.map((row) => [...row]);
  let fewest = total(work.rows, byRank, work.pos);
  for (let sweep = 0, stale = 0; sweep < maxSweeps && stale < patience && fewest > 0; sweep++) {
    if (sweep % 2 === 0) for (let r = 1; r < work.rows.length; r++) reorder(work, r, ups);
    else for (let r = work.rows.length - 2; r >= 0; r--) reorder(work, r, downs);
    transpose(work);
    const n = total(work.rows, byRank, work.pos);
    if (n < fewest) {
      fewest = n;
      best = work.rows.map((row) => [...row]);
      stale = 0;
    } else stale++;
  }
  return best;
}
