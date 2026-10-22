/** A bounding volume hierarchy over axis-aligned boxes in any dimension: the
 *  broad phase for point, box, ray and half-space picks. Boxes are closed,
 *  so two that touch at an edge meet; callers apply their own exact test. */
import { LEAF_SIZE, BvhTree } from './bvhTree';
import { Scratch, queryHalfSpaces, queryOverlap, raycast, type HalfSpace } from './bvhQuery';

export type { HalfSpace };

/** Box layout: [min_0..min_{d-1}, max_0..max_{d-1}]. */
export type BoxN = ArrayLike<number>;

export interface Bvh<K> {
  readonly dim: number;
  readonly size: number;
  /** False (and not stored) when any coordinate is non-finite or min > max.
   *  Inserting a key already present updates it. */
  insert(key: K, box: BoxN): boolean;
  /** False, keeping the old box, when the key is absent or the box invalid. */
  update(key: K, box: BoxN): boolean;
  remove(key: K): boolean;
  /** Tighten every node box after updates that only moved items in place. */
  refit(): void;
  /** Rebuild the hierarchy top-down from the current boxes. */
  rebuild(): void;
  /** visit returns false to stop. */
  queryBox(box: BoxN, visit: (key: K) => boolean | void): void;
  queryPoint(p: ArrayLike<number>, visit: (key: K) => boolean | void): void;
  /** Leaves in nondecreasing order of box entry distance t (t >= 0, t <= tMax). */
  raycast(origin: ArrayLike<number>, dir: ArrayLike<number>, visit: (key: K, t: number) => boolean | void, tMax?: number): void;
  /** Leaves whose box is not wholly outside any half-space (conservative). */
  queryHalfSpaces(planes: readonly HalfSpace[], visit: (key: K) => boolean | void): void;
}

function validBox(box: BoxN, dim: number): boolean {
  if (box.length < 2 * dim) return false;
  for (let j = 0; j < dim; j++) {
    const lo = box[j];
    const hi = box[dim + j];
    if (!Number.isFinite(lo) || !Number.isFinite(hi) || lo > hi) return false;
  }
  return true;
}

class BvhImpl<K> implements Bvh<K> {
  readonly dim: number;
  private readonly tree: BvhTree<K>;
  private readonly items = new Map<K, number>();
  private readonly scratch = new Scratch();

  constructor(dim: number) {
    this.dim = dim;
    this.tree = new BvhTree<K>(dim);
  }

  get size(): number { return this.items.size; }

  /** Store without touching the topology; `rebuild` places them. */
  load(entries: Iterable<readonly [K, BoxN]>): void {
    for (const [key, box] of entries) {
      if (!validBox(box, this.dim)) continue;
      const old = this.items.get(key);
      if (old !== undefined) { this.tree.writeItemBox(old, box); continue; }
      const it = this.tree.allocItem(key, box);
      this.tree.itemLeaf[it] = 0;
      this.items.set(key, it);
    }
  }

  insert(key: K, box: BoxN): boolean {
    if (!validBox(box, this.dim)) return false;
    if (this.items.has(key)) return this.update(key, box);
    const it = this.tree.allocItem(key, box);
    this.items.set(key, it);
    this.place(it);
    return true;
  }

  update(key: K, box: BoxN): boolean {
    const it = this.items.get(key);
    if (it === undefined || !validBox(box, this.dim)) return false;
    const t = this.tree;
    const leaf = t.itemLeaf[it];
    if (this.leafHolds(leaf, box)) {
      t.writeItemBox(it, box);
      return true;
    }
    this.detach(it);
    t.writeItemBox(it, box);
    this.place(it);
    return true;
  }

  remove(key: K): boolean {
    const it = this.items.get(key);
    if (it === undefined) return false;
    this.detach(it);
    this.items.delete(key);
    this.tree.freeItem(it);
    return true;
  }

  refit(): void {
    const t = this.tree;
    if (t.root === -1) return;
    // Children are pushed after their parent, so the reversed order is bottom-up.
    const order: number[] = [t.root];
    for (let i = 0; i < order.length; i++) {
      const n = order[i];
      if (t.left[n] !== -1) order.push(t.left[n], t.right[n]);
    }
    for (let i = order.length - 1; i >= 0; i--) t.computeBox(order[i]);
  }

  rebuild(): void { this.tree.build(); }

  queryBox(box: BoxN, visit: (key: K) => boolean | void): void {
    queryOverlap(this.tree, this.scratch, box, 0, this.dim, visit);
  }

  queryPoint(p: ArrayLike<number>, visit: (key: K) => boolean | void): void {
    queryOverlap(this.tree, this.scratch, p, 0, 0, visit);
  }

  raycast(origin: ArrayLike<number>, dir: ArrayLike<number>, visit: (key: K, t: number) => boolean | void, tMax = Infinity): void {
    raycast(this.tree, this.scratch, origin, dir, visit, tMax);
  }

  queryHalfSpaces(planes: readonly HalfSpace[], visit: (key: K) => boolean | void): void {
    queryHalfSpaces(this.tree, this.scratch, planes, visit);
  }

  private leafHolds(leaf: number, box: BoxN): boolean {
    const d = this.dim;
    const o = leaf * 2 * d;
    const nb = this.tree.nodeBox;
    for (let j = 0; j < d; j++) if (box[j] < nb[o + j] || box[d + j] > nb[o + d + j]) return false;
    return true;
  }

  /** Descend by least enlargement and add `it` to a leaf, splitting it when full. */
  private place(it: number): void {
    const t = this.tree;
    if (t.root === -1) {
      t.root = t.allocNode(-1);
      t.placeInLeaf(t.root, it);
      t.computeBox(t.root);
      return;
    }
    let n = t.root;
    while (t.left[n] !== -1) {
      const l = t.left[n];
      const r = t.right[n];
      const el = this.enlargement(l, it);
      const er = this.enlargement(r, it);
      n = el < er || (el === er && this.margin(l) <= this.margin(r)) ? l : r;
    }
    if (t.leafCount[n] < LEAF_SIZE) t.placeInLeaf(n, it);
    else t.splitLeaf(n, it);
    t.refitUp(n);
  }

  /** Margin (sum of extents) a node would gain by covering item `it`. Margin
   *  rather than volume, so zero-extent boxes still rank. */
  private enlargement(n: number, it: number): number {
    const d = this.dim;
    const nb = this.tree.nodeBox;
    const ib = this.tree.itemBox;
    const o = n * 2 * d;
    const io = it * 2 * d;
    let grow = 0;
    for (let j = 0; j < d; j++) {
      const lo = Math.min(nb[o + j], ib[io + j]);
      const hi = Math.max(nb[o + d + j], ib[io + d + j]);
      grow += hi - lo - (nb[o + d + j] - nb[o + j]);
    }
    return grow;
  }

  private margin(n: number): number {
    const d = this.dim;
    const nb = this.tree.nodeBox;
    const o = n * 2 * d;
    let m = 0;
    for (let j = 0; j < d; j++) m += nb[o + d + j] - nb[o + j];
    return m;
  }

  /** Take `it` out of its leaf, collapsing the leaf into its sibling when it empties. */
  private detach(it: number): void {
    const t = this.tree;
    const leaf = t.itemLeaf[it];
    const base = leaf * LEAF_SIZE;
    const count = t.leafCount[leaf];
    for (let k = 0; k < count; k++) {
      if (t.leafItems[base + k] !== it) continue;
      t.leafItems[base + k] = t.leafItems[base + count - 1];
      break;
    }
    t.leafCount[leaf] = count - 1;
    t.itemLeaf[it] = -1;
    if (count > 1) { t.refitUp(leaf); return; }
    const p = t.parent[leaf];
    t.freeNode(leaf);
    if (p === -1) { t.root = -1; return; }
    const sib = t.left[p] === leaf ? t.right[p] : t.left[p];
    const g = t.parent[p];
    t.parent[sib] = g;
    if (g === -1) t.root = sib;
    else if (t.left[g] === p) t.left[g] = sib;
    else t.right[g] = sib;
    t.freeNode(p);
    t.refitUp(g);
  }
}

export function createBvh<K>(dim: number, entries?: Iterable<readonly [K, BoxN]>): Bvh<K> {
  if (!Number.isInteger(dim) || dim < 1) throw new RangeError(`createBvh: dim must be a positive integer, got ${dim}`);
  const bvh = new BvhImpl<K>(dim);
  if (entries) {
    bvh.load(entries);
    bvh.rebuild();
  }
  return bvh;
}
