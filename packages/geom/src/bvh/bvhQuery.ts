/** Traversals over a `BvhTree`. Each takes its buffers from a `Scratch`,
 *  so a query allocates nothing unless a visit re-enters the tree. */
import { LEAF_SIZE, type BvhTree } from './bvhTree';

export interface HalfSpace { normal: ArrayLike<number>; offset: number }

type Visit<K> = (key: K) => boolean | void;

/** Reusable traversal buffers; a re-entrant query gets fresh ones. */
export class Scratch {
  stack = new Int32Array(64);
  heapT = new Float64Array(64);
  heapId = new Int32Array(64);
  private busy = false;

  take(): Scratch {
    if (this.busy) return new Scratch();
    this.busy = true;
    return this;
  }

  release(): void { this.busy = false; }

  stackAt(len: number): Int32Array {
    if (len >= this.stack.length) {
      const next = new Int32Array(this.stack.length * 2);
      next.set(this.stack);
      this.stack = next;
    }
    return this.stack;
  }

  ensureHeap(len: number): void {
    if (len < this.heapT.length) return;
    const t = new Float64Array(this.heapT.length * 2);
    const id = new Int32Array(this.heapId.length * 2);
    t.set(this.heapT);
    id.set(this.heapId);
    this.heapT = t;
    this.heapId = id;
  }
}

/** Push onto the min-heap of `size` entries in `sc`; returns the new size. */
function heapPush(sc: Scratch, size: number, t: number, id: number): number {
  sc.ensureHeap(size + 1);
  const ht = sc.heapT;
  const hid = sc.heapId;
  let i = size;
  while (i > 0) {
    const p = (i - 1) >> 1;
    if (ht[p] <= t) break;
    ht[i] = ht[p]; hid[i] = hid[p];
    i = p;
  }
  ht[i] = t; hid[i] = id;
  return size + 1;
}

/** Drop the minimum of a heap of `size` entries. */
function heapPop(sc: Scratch, size: number): void {
  const ht = sc.heapT;
  const hid = sc.heapId;
  const n = size - 1;
  const lastT = ht[n];
  const lastId = hid[n];
  let i = 0;
  for (;;) {
    let c = 2 * i + 1;
    if (c >= n) break;
    if (c + 1 < n && ht[c + 1] < ht[c]) c++;
    if (ht[c] >= lastT) break;
    ht[i] = ht[c]; hid[i] = hid[c];
    i = c;
  }
  ht[i] = lastT; hid[i] = lastId;
}

/** Closed-interval overlap of the box at `arr[o]` with the query box whose
 *  mins sit at `q[qmin]` and maxes at `q[qmax]`. */
function meets(arr: Float64Array, o: number, d: number, q: ArrayLike<number>, qmin: number, qmax: number): boolean {
  for (let j = 0; j < d; j++) if (arr[o + j] > q[qmax + j] || q[qmin + j] > arr[o + d + j]) return false;
  return true;
}

/** Visit every item whose box meets the query box `q[qmin..]`/`q[qmax..]`. */
export function queryOverlap<K>(tree: BvhTree<K>, pool: Scratch, q: ArrayLike<number>, qmin: number, qmax: number, visit: Visit<K>): void {
  if (tree.root === -1) return;
  const sc = pool.take();
  const d = tree.dim;
  const s = 2 * d;
  try {
    let stack = sc.stackAt(0);
    let sp = 0;
    stack[sp++] = tree.root;
    while (sp > 0) {
      const n = stack[--sp];
      if (!meets(tree.nodeBox, n * s, d, q, qmin, qmax)) continue;
      if (tree.left[n] === -1) {
        const base = n * LEAF_SIZE;
        for (let k = 0; k < tree.leafCount[n]; k++) {
          const it = tree.leafItems[base + k];
          if (meets(tree.itemBox, it * s, d, q, qmin, qmax) && visit(tree.keys[it] as K) === false) return;
        }
        continue;
      }
      stack = sc.stackAt(sp + 1);
      stack[sp++] = tree.left[n];
      stack[sp++] = tree.right[n];
    }
  } finally {
    sc.release();
  }
}

/** False when the box at `arr[o]` lies wholly outside some plane. */
function notOutside(arr: Float64Array, o: number, d: number, planes: readonly HalfSpace[]): boolean {
  for (let p = 0; p < planes.length; p++) {
    const { normal, offset } = planes[p];
    let v = offset;
    for (let j = 0; j < d; j++) v += normal[j] * (normal[j] >= 0 ? arr[o + d + j] : arr[o + j]);
    if (v < 0) return false;
  }
  return true;
}

export function queryHalfSpaces<K>(tree: BvhTree<K>, pool: Scratch, planes: readonly HalfSpace[], visit: Visit<K>): void {
  if (tree.root === -1) return;
  const sc = pool.take();
  const d = tree.dim;
  const s = 2 * d;
  try {
    let stack = sc.stackAt(0);
    let sp = 0;
    stack[sp++] = tree.root;
    while (sp > 0) {
      const n = stack[--sp];
      if (!notOutside(tree.nodeBox, n * s, d, planes)) continue;
      if (tree.left[n] === -1) {
        const base = n * LEAF_SIZE;
        for (let k = 0; k < tree.leafCount[n]; k++) {
          const it = tree.leafItems[base + k];
          if (notOutside(tree.itemBox, it * s, d, planes) && visit(tree.keys[it] as K) === false) return;
        }
        continue;
      }
      stack = sc.stackAt(sp + 1);
      stack[sp++] = tree.left[n];
      stack[sp++] = tree.right[n];
    }
  } finally {
    sc.release();
  }
}

/** Slab test: the ray's entry t into the box at `arr[o]`, clamped to
 *  [0, tMax], or -1 when it misses. */
function entry(arr: Float64Array, o: number, d: number, org: ArrayLike<number>, dir: ArrayLike<number>, tMax: number): number {
  let near = 0;
  let far = tMax;
  for (let j = 0; j < d; j++) {
    const lo = arr[o + j];
    const hi = arr[o + d + j];
    const dj = dir[j];
    if (dj === 0) {
      if (org[j] < lo || org[j] > hi) return -1;
      continue;
    }
    const inv = 1 / dj;
    const t1 = (lo - org[j]) * inv;
    const t2 = (hi - org[j]) * inv;
    if (t1 < t2) { if (t1 > near) near = t1; if (t2 < far) far = t2; }
    else { if (t2 > near) near = t2; if (t1 < far) far = t1; }
    if (near > far) return -1;
  }
  return near;
}

/** Best-first over entry t: nodes and items share one min-heap, an item
 *  stored as `-(index + 1)`, so items pop in nondecreasing t. */
export function raycast<K>(
  tree: BvhTree<K>, pool: Scratch, org: ArrayLike<number>, dir: ArrayLike<number>,
  visit: (key: K, t: number) => boolean | void, tMax: number,
): void {
  if (tree.root === -1) return;
  const d = tree.dim;
  const s = 2 * d;
  const t0 = entry(tree.nodeBox, tree.root * s, d, org, dir, tMax);
  if (t0 < 0) return;
  const sc = pool.take();
  try {
    let size = heapPush(sc, 0, t0, tree.root);
    while (size > 0) {
      const t = sc.heapT[0];
      const id = sc.heapId[0];
      heapPop(sc, size--);
      if (id < 0) {
        if (visit(tree.keys[-id - 1] as K, t) === false) return;
        continue;
      }
      if (tree.left[id] === -1) {
        const base = id * LEAF_SIZE;
        for (let k = 0; k < tree.leafCount[id]; k++) {
          const it = tree.leafItems[base + k];
          const ti = entry(tree.itemBox, it * s, d, org, dir, tMax);
          if (ti >= 0) size = heapPush(sc, size, ti, -it - 1);
        }
        continue;
      }
      const l = tree.left[id];
      const r = tree.right[id];
      const tl = entry(tree.nodeBox, l * s, d, org, dir, tMax);
      if (tl >= 0) size = heapPush(sc, size, tl, l);
      const tr = entry(tree.nodeBox, r * s, d, org, dir, tMax);
      if (tr >= 0) size = heapPush(sc, size, tr, r);
    }
  } finally {
    sc.release();
  }
}
