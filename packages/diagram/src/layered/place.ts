/** Placement across the rank: Brandes & Köpf, "Fast and Simple Horizontal
 *  Coordinate Assignment" (2001), with nodes of varying extent. */
import { extent } from '../layout';
import { isPlaceholder, type Hop, type Rows } from './types';

type Neighbors = Map<string, string[]>;
type Conflicts = Map<string, Set<string>>;

interface Frame {
  rows: string[][];
  size: Map<string, number>;
  gap: number;
  /** For each upper and lower pair joined by a hop, keyed `upper\0lower`:
   *  where its first hop meets each, as `Hop.fromAt` and `Hop.toAt`. */
  ports: Map<string, readonly [upper: number, lower: number]>;
}

const pairKey = (upper: string, lower: string) => `${upper}\u0000${lower}`;

/**
 * Each node's low corner along the cross axis `axis`, keyed by node id
 * (placeholders included), with the smallest low corner at 0.
 *
 * The order inside each rank is kept as given; neighbors in a rank sit at
 * least their half-extents plus `nodeGap` apart, center to center. Each hop
 * joins a node in rank `r` to one in rank `r + 1`; several hops between the
 * same pair count once, at the first one's ports. Aligning a pair lines up
 * where the hop meets each (`Hop.fromAt`, `Hop.toAt`), not the two centers.
 * The result is the balanced combination of four alignments, which lines a
 * straight run up exactly and keeps a run of placeholders straight where
 * another wire crosses it.
 */
export function placeAcross(rows: Rows, hops: readonly Hop[], axis: 'x' | 'y', nodeGap: number): Map<string, number> {
  const frame: Frame = { rows: rows.map((row) => row.map((n) => n.id)), size: new Map(), gap: nodeGap, ports: new Map() };
  for (const row of rows) for (const node of row) frame.size.set(node.id, extent(node.bounds, axis));
  for (const hop of hops) {
    const key = pairKey(hop.from, hop.to);
    if (!frame.ports.has(key)) frame.ports.set(key, [hop.fromAt ?? 0.5, hop.toAt ?? 0.5]);
  }
  const { up, down } = neighborsOf(frame.rows, hops);
  const conflicts = markConflicts(frame.rows, up);

  const layouts: { xs: Map<string, number>; right: boolean }[] = [];
  for (const downward of [true, false]) {
    for (const right of [false, true]) {
      layouts.push({ xs: alignedLayout(frame, downward ? up : down, conflicts, downward, right), right });
    }
  }

  const spans = layouts.map(({ xs }) => spanOf(xs, frame.size));
  let narrowest = 0;
  for (let i = 1; i < spans.length; i++) if (spans[i]!.max - spans[i]!.min < spans[narrowest]!.max - spans[narrowest]!.min) narrowest = i;
  const target = spans[narrowest]!;
  for (const [i, { xs, right }] of layouts.entries()) {
    const delta = right ? target.max - spans[i]!.max : target.min - spans[i]!.min;
    for (const [id, x] of xs) xs.set(id, x + delta);
  }

  const low = new Map<string, number>();
  let least = Infinity;
  for (const [id, size] of frame.size) {
    const four = layouts.map(({ xs }) => xs.get(id)!).sort((a, b) => a - b);
    const corner = (four[1]! + four[2]!) / 2 - size / 2;
    low.set(id, corner);
    least = Math.min(least, corner);
  }
  for (const [id, corner] of low) low.set(id, corner - least);
  return low;
}

/** Upper and lower neighbors of every node, deduplicated, in rank order. */
function neighborsOf(rows: string[][], hops: readonly Hop[]): { up: Neighbors; down: Neighbors } {
  const rank = new Map<string, number>();
  const pos = new Map<string, number>();
  const up: Neighbors = new Map();
  const down: Neighbors = new Map();
  for (const [r, row] of rows.entries()) {
    for (const [i, id] of row.entries()) {
      rank.set(id, r);
      pos.set(id, i);
      up.set(id, []);
      down.set(id, []);
    }
  }
  for (const hop of hops) {
    const from = rank.get(hop.from);
    const to = rank.get(hop.to);
    if (from === undefined || to === undefined || to !== from + 1) {
      throw new Error(`placeAcross: hop ${hop.from} -> ${hop.to} does not join adjacent ranks`);
    }
    const ups = up.get(hop.to)!;
    if (!ups.includes(hop.from)) ups.push(hop.from);
    const downs = down.get(hop.from)!;
    if (!downs.includes(hop.to)) downs.push(hop.to);
  }
  const byPos = (a: string, b: string) => pos.get(a)! - pos.get(b)!;
  for (const list of up.values()) list.sort(byPos);
  for (const list of down.values()) list.sort(byPos);
  return { up, down };
}

const isMarked = (conflicts: Conflicts, a: string, b: string): boolean => conflicts.get(a)?.has(b) ?? false;

function mark(conflicts: Conflicts, a: string, b: string): void {
  for (const [x, y] of [[a, b], [b, a]] as const) {
    let set = conflicts.get(x);
    if (set === undefined) conflicts.set(x, (set = new Set()));
    set.add(y);
  }
}

/** Type-1 conflicts: a hop that is not between two placeholders, crossing one
 *  that is. The outer hop is marked, so alignment never takes it. */
function markConflicts(rows: string[][], up: Neighbors): Conflicts {
  const conflicts: Conflicts = new Map();
  for (let r = 1; r < rows.length; r++) {
    const upperPos = new Map(rows[r - 1]!.map((id, i) => [id, i]));
    const lower = rows[r]!;
    let k0 = 0;
    let scan = 0;
    for (let l1 = 0; l1 < lower.length; l1++) {
      const v = lower[l1]!;
      const inner = isPlaceholder(v) ? up.get(v)!.find(isPlaceholder) : undefined;
      if (inner === undefined && l1 !== lower.length - 1) continue;
      const k1 = inner !== undefined ? upperPos.get(inner)! : rows[r - 1]!.length - 1;
      for (; scan <= l1; scan++) {
        const w = lower[scan]!;
        for (const u of up.get(w)!) {
          const k = upperPos.get(u)!;
          if ((k < k0 || k > k1) && !(isPlaceholder(u) && isPlaceholder(w))) mark(conflicts, u, w);
        }
      }
      k0 = k1;
    }
  }
  return conflicts;
}

/** One of the four layouts: centers along the cross axis, in the original
 *  orientation. `downward` aligns each node with its upper neighbors,
 *  sweeping from the first rank; `right` sweeps each rank from its far end. */
function alignedLayout(frame: Frame, nbrs: Neighbors, conflicts: Conflicts, downward: boolean, right: boolean): Map<string, number> {
  const ranks = downward ? frame.rows : [...frame.rows].reverse();
  const rows = right ? ranks.map((row) => [...row].reverse()) : ranks;
  const pos = new Map<string, number>();
  for (const row of rows) for (const [i, id] of row.entries()) pos.set(id, i);

  const root = new Map<string, string>();
  const align = new Map<string, string>();
  // Each node's center less its block root's, so the ports an aligned hop
  // joins sit level rather than the two centers.
  const shift = new Map<string, number>();
  for (const row of rows) {
    for (const id of row) {
      root.set(id, id);
      align.set(id, id);
      shift.set(id, 0);
    }
  }
  /** How far `id`'s port for the hop to `other` sits from its center, in this
   *  layout's orientation. */
  const offset = (id: string, other: string): number => {
    const below = frame.ports.get(pairKey(id, other));
    const frac = below !== undefined ? below[0] : frame.ports.get(pairKey(other, id))?.[1] ?? 0.5;
    return ((right ? 1 - frac : frac) - 0.5) * frame.size.get(id)!;
  };
  for (const row of rows) {
    let taken = -1;
    for (const v of row) {
      const ws = [...nbrs.get(v)!].sort((a, b) => pos.get(a)! - pos.get(b)!);
      if (ws.length === 0) continue;
      const lo = Math.floor((ws.length - 1) / 2);
      const hi = Math.ceil((ws.length - 1) / 2);
      for (const m of lo === hi ? [lo] : [lo, hi]) {
        if (align.get(v) !== v) break;
        const u = ws[m]!;
        if (taken < pos.get(u)! && !isMarked(conflicts, u, v)) {
          align.set(u, v);
          root.set(v, root.get(u)!);
          align.set(v, root.get(v)!);
          shift.set(v, shift.get(u)! + offset(u, v) - offset(v, u));
          taken = pos.get(u)!;
        }
      }
    }
  }

  const xs = compact(rows, root, shift, frame);
  const out = new Map<string, number>();
  for (const [id, r] of root) {
    const x = xs.get(r)! + shift.get(id)!;
    out.set(id, right ? -x : x);
  }
  return out;
}

/** Horizontal compaction over the block graph: each block (an aligned run,
 *  named by its root) is placed as far toward the low end as its left
 *  neighbors allow, then pulled toward the high end as far as its right
 *  neighbors allow, which closes the gaps between separate classes. */
function compact(rows: string[][], root: Map<string, string>, shift: Map<string, number>, frame: Frame): Map<string, number> {
  const blocks: string[] = [];
  const preds = new Map<string, Map<string, number>>();
  const succs = new Map<string, Map<string, number>>();
  for (const row of rows) {
    for (const id of row) {
      const r = root.get(id)!;
      if (preds.has(r)) continue;
      blocks.push(r);
      preds.set(r, new Map());
      succs.set(r, new Map());
    }
  }
  for (const row of rows) {
    for (let j = 1; j < row.length; j++) {
      const a = row[j - 1]!;
      const b = row[j]!;
      const ra = root.get(a)!;
      const rb = root.get(b)!;
      const sep = (frame.size.get(a)! + frame.size.get(b)!) / 2 + frame.gap + shift.get(a)! - shift.get(b)!;
      const prior = preds.get(rb)!.get(ra) ?? -Infinity;
      if (sep <= prior) continue;
      preds.get(rb)!.set(ra, sep);
      succs.get(ra)!.set(rb, sep);
    }
  }

  const waiting = new Map(blocks.map((b) => [b, preds.get(b)!.size]));
  const order: string[] = [];
  const ready = blocks.filter((b) => waiting.get(b) === 0);
  while (ready.length > 0) {
    const b = ready.shift()!;
    order.push(b);
    for (const s of succs.get(b)!.keys()) {
      const left = waiting.get(s)! - 1;
      waiting.set(s, left);
      if (left === 0) ready.push(s);
    }
  }
  if (order.length !== blocks.length) throw new Error('placeAcross: alignment produced crossing blocks');

  const xs = new Map<string, number>();
  for (const b of order) {
    let x = 0;
    for (const [p, sep] of preds.get(b)!) x = Math.max(x, xs.get(p)! + sep);
    xs.set(b, x);
  }
  for (let i = order.length - 1; i >= 0; i--) {
    const b = order[i]!;
    let x = Infinity;
    for (const [s, sep] of succs.get(b)!) x = Math.min(x, xs.get(s)! - sep);
    if (x !== Infinity && x > xs.get(b)!) xs.set(b, x);
  }
  return xs;
}

function spanOf(xs: Map<string, number>, size: Map<string, number>): { min: number; max: number } {
  let min = Infinity;
  let max = -Infinity;
  for (const [id, x] of xs) {
    min = Math.min(min, x - size.get(id)! / 2);
    max = Math.max(max, x + size.get(id)! / 2);
  }
  return { min, max };
}
