/**
 * The sparse orthogonal visibility graph of one search window. From each
 * interesting point a horizontal and a vertical line run until they meet an
 * obstacle's inside or the window's edge; a vertex is wherever a horizontal
 * line crosses a vertical one, and each vertex links to the next vertex along
 * each of its lines, which it can see because the line is free between them.
 *
 * Only the lines are built up front. A vertex gets an id, and its neighbors
 * are found, when the search first reaches it.
 */
import type { Vec2 } from '@weasel-js/core/math';
import type { Box } from './types';

/** The graph as a search walks it. Headings are east, south, west, north. */
export interface VisibilityGraph {
  x(v: number): number;
  y(v: number): number;
  /** Vertex `v`'s neighbor in heading `d`, or -1. */
  neighbor(v: number, d: number): number;
  /** The vertex at `p`, or -1 when no line pair crosses there. */
  at(p: Vec2): number;
  /** How many vertices have ids so far. */
  size(): number;
  /** Whether either line through `v` runs on to the window's edge, past
   *  which a larger window might reach more. */
  open(v: number): boolean;
}

const EPS = 1e-7;

/** A free stretch of one line: at `c` across, from `lo` to `hi` along. */
interface Run {
  c: number;
  lo: number;
  hi: number;
}

/** The obstacles of a window as flat arrays, filed in strips across one axis
 *  so a line cast along the other asks only the obstacles its strip holds. */
interface Strips {
  lo: Float64Array;
  hi: Float64Array;
  aLo: Float64Array;
  aHi: Float64Array;
  start: number;
  size: number;
  cells: number[][];
}

const STRIP = 64;
/** Strips a window is cut into at most: a wider one widens its strips, so an obstacle spanning it files in few. */
const MAX_STRIPS = 4096;

/** The strip `v` falls in; every value falls in the one strip of a window with no finite width. */
const stripOf = (s: Strips, v: number): number => (Number.isFinite(s.size) ? Math.floor((v - s.start) / s.size) : 0);

/** `boxes` filed by their extent across `horizontal` lines (by y for lines along x), within `[from, to]`: the
 *  window's, so an obstacle running far past it walks no strips out there. */
function strips(boxes: readonly Box[], horizontal: boolean, from: number, to: number): Strips {
  const n = boxes.length;
  const s: Strips = {
    lo: new Float64Array(n), hi: new Float64Array(n), aLo: new Float64Array(n), aHi: new Float64Array(n),
    start: Infinity, size: Math.max(STRIP, (to - from) / MAX_STRIPS), cells: [],
  };
  boxes.forEach((b, i) => {
    s.lo[i] = horizontal ? b.y : b.x;
    s.hi[i] = horizontal ? b.y + b.height : b.x + b.width;
    s.aLo[i] = horizontal ? b.x : b.y;
    s.aHi[i] = horizontal ? b.x + b.width : b.y + b.height;
    // Written so a box with a NaN side leaves the start alone, rather than every strip index NaN.
    if (Math.max(s.lo[i]!, from) < s.start) s.start = Math.max(s.lo[i]!, from);
  });
  for (let i = 0; i < n; i++) {
    const last = stripOf(s, Math.min(s.hi[i]!, to));
    for (let k = stripOf(s, Math.max(s.lo[i]!, from)); k <= last; k++) {
      (s.cells[k] ??= []).push(i);
    }
  }
  return s;
}

/** How far the line at `c` across, through `at` along, runs each way before
 *  an obstacle's inside or the window's edge stops it; null when the point is
 *  inside one. */
function reach(at: number, c: number, s: Strips, lo: number, hi: number): Run | null {
  const cell = s.cells[stripOf(s, c)] ?? [];
  for (const i of cell) {
    if (c <= s.lo[i]! + EPS || c >= s.hi[i]! - EPS) continue;
    if (s.aHi[i]! <= at + EPS) lo = Math.max(lo, s.aHi[i]!);
    else if (s.aLo[i]! >= at - EPS) hi = Math.min(hi, s.aLo[i]!);
    else return null;
  }
  return { c, lo, hi };
}

/** `runs` merged where they share a line and overlap, sorted by line then start. */
function merged(runs: Run[]): Run[] {
  runs.sort((a, b) => a.c - b.c || a.lo - b.lo);
  const out: Run[] = [];
  for (const r of runs) {
    const last = out[out.length - 1];
    if (last !== undefined && last.c === r.c && r.lo <= last.hi + EPS) last.hi = Math.max(last.hi, r.hi);
    else out.push({ ...r });
  }
  return out;
}

/** The first index of sorted `runs` whose line is past `c` (or at it, with `orAt`). */
function after(runs: readonly Run[], c: number, orAt: boolean): number {
  let lo = 0;
  let hi = runs.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    const m = runs[mid]!.c;
    if (orAt ? m < c - EPS : m <= c + EPS) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}

const covers = (r: Run, at: number) => r.lo <= at + EPS && r.hi >= at - EPS;

/** The run of sorted `runs` on line `c` that covers `at`, or -1. */
function runAt(runs: readonly Run[], c: number, at: number): number {
  for (let k = after(runs, c, true); k < runs.length && runs[k]!.c <= c + EPS; k++) if (covers(runs[k]!, at)) return k;
  return -1;
}

/** The nearest run of `across` crossing run `along`, past line `from` in direction `step`, or -1. */
function crossing(along: Run, from: number, step: 1 | -1, across: readonly Run[]): number {
  if (step > 0) {
    for (let k = after(across, from, false); k < across.length && across[k]!.c <= along.hi + EPS; k++) {
      if (covers(across[k]!, along.c)) return k;
    }
  } else {
    for (let k = after(across, from, true) - 1; k >= 0 && across[k]!.c >= along.lo - EPS; k--) {
      if (covers(across[k]!, along.c)) return k;
    }
  }
  return -1;
}

/** The free lines cast from `points` among `boxes`, horizontal and vertical. */
function castLines(points: readonly Vec2[], boxes: readonly Box[], window: Box): { hs: Run[]; vs: Run[] } {
  // A line is cast from every point, and an end may sit outside the window.
  let [x0, x1, y0, y1] = [window.x, window.x + window.width, window.y, window.y + window.height];
  for (const p of points) [x0, x1, y0, y1] = [Math.min(x0, p.x), Math.max(x1, p.x), Math.min(y0, p.y), Math.max(y1, p.y)];
  const across = strips(boxes, true, y0, y1);
  const down = strips(boxes, false, x0, x1);
  const rows: Run[] = [];
  const cols: Run[] = [];
  for (const p of points) {
    const h = reach(p.x, p.y, across, window.x, window.x + window.width);
    const v = h === null ? null : reach(p.y, p.x, down, window.y, window.y + window.height);
    if (h === null || v === null) continue;
    rows.push(h);
    cols.push(v);
  }
  return { hs: merged(rows), vs: merged(cols) };
}

/** The graph of the lines cast from `points` among `boxes`, the inflated
 *  obstacles in the way, clipped to `window`. */
export function visibilityGraph(points: readonly Vec2[], boxes: readonly Box[], window: Box): VisibilityGraph {
  const { hs, vs } = castLines(points, boxes, window);
  const [x0, x1, y0, y1] = [window.x, window.x + window.width, window.y, window.y + window.height];
  const toEdge = (r: Run, lo: number, hi: number) => r.lo <= lo + EPS || r.hi >= hi - EPS;
  const row: number[] = [];
  const col: number[] = [];
  const near: number[] = [];
  const ids = new Map<number, number>();
  const idOf = (h: number, v: number): number => {
    const key = h * vs.length + v;
    let id = ids.get(key);
    if (id === undefined) {
      id = row.length;
      ids.set(key, id);
      row.push(h);
      col.push(v);
      near.push(-2, -2, -2, -2);
    }
    return id;
  };
  return {
    x: (v) => vs[col[v]!]!.c,
    y: (v) => hs[row[v]!]!.c,
    neighbor(v, d) {
      const known = near[v * 4 + d]!;
      if (known !== -2) return known;
      const h = row[v]!;
      const c = col[v]!;
      let found = -1;
      if (d === 0 || d === 2) {
        const k = crossing(hs[h]!, vs[c]!.c, d === 0 ? 1 : -1, vs);
        if (k >= 0) found = idOf(h, k);
      } else {
        const k = crossing(vs[c]!, hs[h]!.c, d === 1 ? 1 : -1, hs);
        if (k >= 0) found = idOf(k, c);
      }
      near[v * 4 + d] = found;
      return found;
    },
    at(p) {
      const h = runAt(hs, p.y, p.x);
      const v = runAt(vs, p.x, p.y);
      return h < 0 || v < 0 ? -1 : idOf(h, v);
    },
    size: () => row.length,
    open: (v) => toEdge(hs[row[v]!]!, x0, x1) || toEdge(vs[col[v]!]!, y0, y1),
  };
}
