/** Storage and topology for `createBvh`: flat typed arrays for nodes and
 *  items, the top-down build, and the leaf split an insert triggers. */

export const LEAF_SIZE = 4;

/** Node and item storage. A node with `left[n] === -1` is a leaf holding
 *  `leafCount[n]` item indices at `leafItems[n * LEAF_SIZE]`. */
export class BvhTree<K> {
  readonly dim: number;
  root = -1;
  nodeBox: Float64Array;
  left: Int32Array;
  right: Int32Array;
  parent: Int32Array;
  leafCount: Int32Array;
  leafItems: Int32Array;
  private nodeCap = 0;
  private nodeTop = 0;
  private freeNodes: number[] = [];

  itemBox: Float64Array;
  itemLeaf: Int32Array;
  keys: (K | undefined)[] = [];
  private itemCap = 0;
  private itemTop = 0;
  private freeItems: number[] = [];

  constructor(dim: number) {
    this.dim = dim;
    this.nodeBox = new Float64Array(0);
    this.left = this.right = this.parent = this.leafCount = this.leafItems = new Int32Array(0);
    this.itemBox = new Float64Array(0);
    this.itemLeaf = new Int32Array(0);
    this.growNodes(16);
    this.growItems(16);
  }

  private growNodes(cap: number): void {
    const s = 2 * this.dim;
    this.nodeBox = grow(this.nodeBox, cap * s);
    this.left = grow(this.left, cap);
    this.right = grow(this.right, cap);
    this.parent = grow(this.parent, cap);
    this.leafCount = grow(this.leafCount, cap);
    this.leafItems = grow(this.leafItems, cap * LEAF_SIZE);
    this.nodeCap = cap;
  }

  private growItems(cap: number): void {
    this.itemBox = grow(this.itemBox, cap * 2 * this.dim);
    this.itemLeaf = grow(this.itemLeaf, cap);
    this.itemCap = cap;
  }

  allocNode(parent: number): number {
    let n = this.freeNodes.pop();
    if (n === undefined) {
      if (this.nodeTop === this.nodeCap) this.growNodes(this.nodeCap * 2);
      n = this.nodeTop++;
    }
    this.left[n] = -1;
    this.right[n] = -1;
    this.parent[n] = parent;
    this.leafCount[n] = 0;
    return n;
  }

  freeNode(n: number): void {
    this.freeNodes.push(n);
  }

  allocItem(key: K, box: ArrayLike<number>): number {
    let i = this.freeItems.pop();
    if (i === undefined) {
      if (this.itemTop === this.itemCap) this.growItems(this.itemCap * 2);
      i = this.itemTop++;
    }
    this.keys[i] = key;
    this.writeItemBox(i, box);
    return i;
  }

  freeItem(i: number): void {
    this.keys[i] = undefined;
    this.itemLeaf[i] = -1;
    this.freeItems.push(i);
  }

  writeItemBox(i: number, box: ArrayLike<number>): void {
    const s = 2 * this.dim;
    for (let j = 0; j < s; j++) this.itemBox[i * s + j] = box[j];
  }

  /** Recompute `n`'s box from its children or items. */
  computeBox(n: number): void {
    const d = this.dim;
    const s = 2 * d;
    const nb = this.nodeBox;
    const o = n * s;
    for (let j = 0; j < d; j++) { nb[o + j] = Infinity; nb[o + d + j] = -Infinity; }
    if (this.left[n] !== -1) {
      unionInto(nb, o, nb, this.left[n] * s, d);
      unionInto(nb, o, nb, this.right[n] * s, d);
      return;
    }
    const base = n * LEAF_SIZE;
    for (let k = 0; k < this.leafCount[n]; k++) unionInto(nb, o, this.itemBox, this.leafItems[base + k] * s, d);
  }

  refitUp(n: number): void {
    for (; n !== -1; n = this.parent[n]) this.computeBox(n);
  }

  /** Discard the topology and rebuild it top-down over every live item. */
  build(): void {
    this.freeNodes = [];
    this.nodeTop = 0;
    this.root = -1;
    const live: number[] = [];
    for (let i = 0; i < this.itemTop; i++) if (this.itemLeaf[i] !== -1) live.push(i);
    if (live.length === 0) return;
    if (this.nodeCap < 2 * live.length) this.growNodes(2 * live.length);
    const idx = Int32Array.from(live);
    this.root = this.buildRange(idx, 0, idx.length, -1);
  }

  private buildRange(idx: Int32Array, lo: number, hi: number, parent: number): number {
    const n = this.allocNode(parent);
    if (hi - lo <= LEAF_SIZE) {
      for (let k = lo; k < hi; k++) this.placeInLeaf(n, idx[k]);
    } else {
      const axis = this.longestCentroidAxis(idx, lo, hi);
      const mid = (lo + hi) >> 1;
      this.select(idx, lo, hi, mid, axis);
      const l = this.buildRange(idx, lo, mid, n);
      const r = this.buildRange(idx, mid, hi, n);
      this.left[n] = l;
      this.right[n] = r;
    }
    this.computeBox(n);
    return n;
  }

  placeInLeaf(n: number, item: number): void {
    this.leafItems[n * LEAF_SIZE + this.leafCount[n]++] = item;
    this.itemLeaf[item] = n;
  }

  /** Turn a full leaf into an internal node over two leaves, the full set
   *  plus `extra` split at the median of their longest centroid axis. */
  splitLeaf(n: number, extra: number): void {
    const base = n * LEAF_SIZE;
    const idx = new Int32Array(LEAF_SIZE + 1);
    for (let k = 0; k < LEAF_SIZE; k++) idx[k] = this.leafItems[base + k];
    idx[LEAF_SIZE] = extra;
    const axis = this.longestCentroidAxis(idx, 0, idx.length);
    const mid = idx.length >> 1;
    this.select(idx, 0, idx.length, mid, axis);
    this.leafCount[n] = 0;
    const l = this.allocNode(n);
    const r = this.allocNode(n);
    for (let k = 0; k < mid; k++) this.placeInLeaf(l, idx[k]);
    for (let k = mid; k < idx.length; k++) this.placeInLeaf(r, idx[k]);
    this.left[n] = l;
    this.right[n] = r;
    this.computeBox(l);
    this.computeBox(r);
  }

  /** Twice the item's centroid on `axis`; only comparisons use it. */
  private centroid2(item: number, axis: number): number {
    const o = item * 2 * this.dim;
    return this.itemBox[o + axis] + this.itemBox[o + this.dim + axis];
  }

  private longestCentroidAxis(idx: Int32Array, lo: number, hi: number): number {
    let best = 0;
    let bestExt = -1;
    for (let a = 0; a < this.dim; a++) {
      let mn = Infinity;
      let mx = -Infinity;
      for (let k = lo; k < hi; k++) {
        const c = this.centroid2(idx[k], a);
        if (c < mn) mn = c;
        if (c > mx) mx = c;
      }
      if (mx - mn > bestExt) { bestExt = mx - mn; best = a; }
    }
    return best;
  }

  /** Quickselect: reorder `idx[lo, hi)` so `idx[k]` holds the item whose
   *  centroid on `axis` ranks k, with smaller ones before it. */
  private select(idx: Int32Array, lo: number, hi: number, k: number, axis: number): void {
    let a = lo;
    let b = hi - 1;
    while (a < b) {
      const pivot = this.centroid2(idx[(a + b) >> 1], axis);
      let i = a;
      let j = b;
      while (i <= j) {
        while (this.centroid2(idx[i], axis) < pivot) i++;
        while (this.centroid2(idx[j], axis) > pivot) j--;
        if (i <= j) {
          const t = idx[i]; idx[i] = idx[j]; idx[j] = t;
          i++;
          j--;
        }
      }
      if (k <= j) b = j;
      else if (k >= i) a = i;
      else return;
    }
  }
}

function grow<T extends Float64Array | Int32Array>(arr: T, len: number): T {
  const next = new (arr.constructor as new (n: number) => T)(len);
  next.set(arr);
  return next;
}

/** Grow the box at `dst[o]` to cover the box at `src[so]`. */
export function unionInto(dst: Float64Array, o: number, src: ArrayLike<number>, so: number, d: number): void {
  for (let j = 0; j < d; j++) {
    if (src[so + j] < dst[o + j]) dst[o + j] = src[so + j];
    if (src[so + d + j] > dst[o + d + j]) dst[o + d + j] = src[so + d + j];
  }
}
