/** Where directed edges cross one another, and how the winding beside each changes there. */
import type { MeshEdge } from './meshOutline';

/**
 * Every proper crossing of two edges, as two entries: `2p` on one edge and
 * `2p + 1` on the other. A wide stroke's outline crosses itself about a
 * million times, so these live in flat typed arrays.
 */
export interface Crossings {
  /** Per entry, the edge it lies on. */
  edge: Int32Array;
  /** Per entry, its parameter along that edge, 0 at its start. */
  t: Float64Array;
  /** Per entry, how the winding just left of its edge changes past it. */
  step: Int32Array;
  /** Per entry, the steps of the entries on its edge before it, summed. */
  before: Int32Array;
  /** The entries of edge `i` in order along it: `order[first[i]]` up to `order[first[i + 1]]`. */
  order: Int32Array;
  first: Int32Array;
}

/** Growable storage for entries as they are found. */
class Entries {
  edge = new Int32Array(1024);
  t = new Float64Array(1024);
  step = new Int32Array(1024);
  size = 0;
  push(edge: number, t: number, step: number): void {
    if (this.size === this.edge.length) {
      const grow = <A extends Int32Array | Float64Array>(a: A): A => {
        const b = new (a.constructor as new (n: number) => A)(a.length * 2);
        b.set(a);
        return b;
      };
      this.edge = grow(this.edge);
      this.t = grow(this.t);
      this.step = grow(this.step);
    }
    this.edge[this.size] = edge;
    this.t[this.size] = t;
    this.step[this.size] = step;
    this.size++;
  }
}

/**
 * The proper crossings of `edges`. Edges that only touch, at a shared end or
 * one's end on the other, do not cross: a mesh's outline has its T-junctions
 * split already.
 */
export function crossingsOf(edges: readonly MeshEdge[]): Crossings {
  const m = edges.length;
  const byX = edges.map((_, i) => i).sort((p, q) => Math.min(edges[p]!.ax, edges[p]!.bx) - Math.min(edges[q]!.ax, edges[q]!.bx));
  const ax = new Float64Array(m), ay = new Float64Array(m), ex = new Float64Array(m), ey = new Float64Array(m);
  const x0 = new Float64Array(m), x1 = new Float64Array(m), y0 = new Float64Array(m), y1 = new Float64Array(m);
  const n = new Int32Array(m), id = new Int32Array(m);
  byX.forEach((i, k) => {
    const e = edges[i]!;
    ax[k] = e.ax; ay[k] = e.ay; ex[k] = e.bx - e.ax; ey[k] = e.by - e.ay;
    x0[k] = Math.min(e.ax, e.bx); x1[k] = Math.max(e.ax, e.bx);
    y0[k] = Math.min(e.ay, e.by); y1[k] = Math.max(e.ay, e.by);
    n[k] = e.n; id[k] = i;
  });
  const found = new Entries();
  for (let p = 0; p < m; p++) {
    const pax = ax[p]!, pay = ay[p]!, pex = ex[p]!, pey = ey[p]!, pbx = pax + pex, pby = pay + pey;
    const right = x1[p]!, low = y0[p]!, high = y1[p]!;
    for (let q = p + 1; q < m; q++) {
      if (x0[q]! > right) break;
      if (y1[q]! < low || y0[q]! > high) continue;
      const qax = ax[q]!, qay = ay[q]!, qex = ex[q]!, qey = ey[q]!;
      const d1 = pex * (qay - pay) - pey * (qax - pax);
      const d2 = pex * (qay + qey - pay) - pey * (qax + qex - pax);
      if (!(d1 * d2 < 0)) continue;
      const d3 = qex * (pay - qay) - qey * (pax - qax);
      const d4 = qex * (pby - qay) - qey * (pbx - qax);
      if (!(d3 * d4 < 0)) continue;
      // Going along one edge past the other enters the other's left side when it points that way, raising the
      // winding by the other's count; going along the other then leaves the first's left side.
      const turn = Math.sign(qex * pey - qey * pex);
      found.push(id[p]!, d3 / (d3 - d4), n[q]! * turn);
      found.push(id[q]!, d1 / (d1 - d2), -n[p]! * turn);
    }
  }
  return ordered(found, m);
}

/** `found`'s entries listed edge by edge, each edge's in order along it. */
function ordered(found: Entries, edges: number): Crossings {
  const size = found.size;
  const edge = found.edge.subarray(0, size), t = found.t.subarray(0, size), step = found.step.subarray(0, size);
  const first = new Int32Array(edges + 1);
  for (let k = 0; k < size; k++) first[edge[k]! + 1]!++;
  let longest = 0;
  for (let i = 0; i < edges; i++) {
    longest = Math.max(longest, first[i + 1]!);
    first[i + 1]! += first[i]!;
  }
  const order = new Int32Array(size);
  const fill = first.slice(0, edges);
  for (let k = 0; k < size; k++) order[fill[edge[k]!]!++] = k;
  const keys = new Float64Array(longest);
  const words = new Uint32Array(keys.buffer);
  const before = new Int32Array(size);
  for (let i = 0; i < edges; i++) {
    const run = order.subarray(first[i]!, first[i + 1]!);
    if (run.length > 1) sortRun(run, t, keys, words);
    let sum = 0;
    for (const k of run) { before[k] = sum; sum += step[k]!; }
  }
  return { edge, t, step, before, order, first };
}

/** The low word of a float64 in a `Uint32Array` over it. */
const LOW = new Uint8Array(new Uint16Array([1]).buffer)[0] === 1 ? 0 : 1;

/**
 * `run` sorted by `t`. Comparing in a callback dominated the whole outline,
 * so each key is its `t` with its lowest mantissa bits holding its place in
 * the run, sorted as plain numbers. That ties crossings less than 2^-32 of
 * their parameter apart, far closer than float32 can place a point.
 */
function sortRun(run: Int32Array, t: Float64Array, keys: Float64Array, words: Uint32Array): void {
  const bits = 32 - Math.clz32(run.length - 1);
  if (bits > 20) {
    run.sort((a, b) => t[a]! - t[b]!);
    return;
  }
  const mask = (1 << bits) - 1;
  const at = keys.subarray(0, run.length);
  for (let k = 0; k < run.length; k++) {
    at[k] = t[run[k]!]!;
    words[2 * k + LOW] = ((words[2 * k + LOW]! & ~mask) | k) >>> 0;
  }
  at.sort();
  const was = Int32Array.from(run);
  for (let k = 0; k < run.length; k++) run[k] = was[words[2 * k + LOW]! & mask]!;
}
