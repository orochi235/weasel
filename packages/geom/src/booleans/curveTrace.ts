/** Joining a boolean's boundary edges into closed loops. */

import type { Point } from '../paths/cubicMath';
import { type Seg, evalSeg, subSeg } from './contourSegments';
import type { Edge } from './curveEdges';

const TAU = Math.PI * 2;
/** Directions closer than this (radians) are a tie, settled a little way along the curves. */
const TIE = 1e-7;

/** Direction an edge leaves its start in: toward the first control point off it. */
function leaving(s: Seg): Point {
  const a = s[0];
  for (let i = 1; i < s.length; i++) if (s[i].x !== a.x || s[i].y !== a.y) return { x: s[i].x - a.x, y: s[i].y - a.y };
  return { x: 0, y: 0 };
}

const backward = (s: Seg): Seg => s.slice().reverse();

/** Direction from an edge's start to the point a short way along it. */
function along(s: Seg, dist: number): Point {
  let len = 0;
  for (let i = 0; i + 1 < s.length; i++) len += Math.hypot(s[i + 1].x - s[i].x, s[i + 1].y - s[i].y);
  const p = evalSeg(s, len === 0 ? 0 : Math.min(1, dist / len));
  return { x: p.x - s[0].x, y: p.y - s[0].y };
}

const angle = (d: Point): number => Math.atan2(d.y, d.x);

/** Clockwise turn from `from` to `to`, in (0, 2π]. */
function clockwise(from: number, to: number): number {
  const d = (from - to) % TAU;
  return d <= 0 ? d + TAU : d;
}

function chordLength(s: Seg): number {
  const a = s[0], b = s[s.length - 1];
  return Math.hypot(b.x - a.x, b.y - a.y) || Math.hypot(s[1].x - a.x, s[1].y - a.y);
}

/**
 * The edge a loop with its fill on the left takes after arriving along `e`:
 * of those leaving where `e` ends, the first clockwise from the way `e` came
 * in. -1 when none leaves, or two directions tie even a little way along.
 */
function nextEdge(e: Edge, out: readonly Edge[][]): number {
  const cands = out[e.to];
  if (!cands || cands.length === 0) return -1;
  if (cands.length === 1) return cands[0].key;
  const back = backward(e.seg);
  const turns = (dir: (s: Seg) => Point) => {
    const from = angle(dir(back));
    return cands.map((c) => clockwise(from, angle(dir(c.seg))));
  };
  const tied = (t: number[]) => {
    const sorted = t.slice().sort((x, y) => x - y);
    return sorted[0] < TIE || sorted[sorted.length - 1] > TAU - TIE || sorted[1] - sorted[0] < TIE;
  };
  let t = turns(leaving);
  if (tied(t)) {
    const dist = 1e-3 * Math.min(chordLength(e.seg), ...cands.map((c) => chordLength(c.seg)));
    t = turns((s) => along(s, dist));
    if (tied(t)) return -1;
  }
  let best = 0;
  for (let i = 1; i < t.length; i++) if (t[i] < t[best]) best = i;
  return cands[best].key;
}

/** `e` then `f` as one piece of their source, when they are neighbors on it. */
function joined(e: Edge, f: Edge): Edge | null {
  if (e.source !== f.source || e.reversed !== f.reversed) return null;
  const [lo, hi] = e.reversed ? [f, e] : [e, f];
  if (lo.t1 !== hi.t0) return null;
  const t0 = lo.t0, t1 = hi.t1;
  const a = lo.seg[e.reversed ? lo.seg.length - 1 : 0], b = hi.seg[e.reversed ? 0 : hi.seg.length - 1];
  const seg = t0 === 0 && t1 === 1 ? lo.source.slice() : subSeg(lo.source, t0, t1, a, b);
  if (!seg) return null;
  seg[0] = a;
  seg[seg.length - 1] = b;
  if (e.reversed) seg.reverse();
  return { ...e, seg, from: e.from, to: f.to, t0, t1 };
}

/** A loop's edges with each run of neighbors on one source curve put back together. */
function rejoin(loop: Edge[]): Seg[] {
  const out: Edge[] = [];
  for (const e of loop) {
    const j = out.length > 0 ? joined(out[out.length - 1], e) : null;
    if (j) out[out.length - 1] = j; else out.push(e);
  }
  while (out.length > 1) {
    const j = joined(out[out.length - 1], out[0]);
    if (!j) break;
    out.pop();
    out[0] = j;
  }
  return out.map((e) => e.seg);
}

/**
 * The closed loops `edges` form, each a list of segments starting at its
 * lowest-keyed edge, with pieces cut from one curve that stayed neighbors
 * joined back into one. Null when the edges do not close up into loops that
 * each use every edge once.
 */
export function traceLoops(edges: readonly Edge[], vertexCount: number): Seg[][] | null {
  const byKey = new Map<number, number>();
  const out: Edge[][] = Array.from({ length: vertexCount }, () => []);
  edges.forEach((e, i) => {
    byKey.set(e.key, i);
    out[e.from].push(e);
  });
  if (byKey.size !== edges.length) return null;
  const next = edges.map((e) => {
    const k = nextEdge(e, out);
    return k < 0 ? -1 : byKey.get(k)!;
  });
  if (next.includes(-1)) return null;

  const loopOf = new Int32Array(edges.length).fill(-1);
  const loops: Seg[][] = [];
  for (let s = 0; s < edges.length; s++) {
    if (loopOf[s] >= 0) continue;
    const loop: number[] = [];
    let e = s;
    do {
      if (loopOf[e] >= 0) return null;
      loopOf[e] = loops.length;
      loop.push(e);
      e = next[e];
    } while (e !== s);
    let first = 0;
    for (let i = 1; i < loop.length; i++) if (edges[loop[i]].key < edges[loop[first]].key) first = i;
    loops.push(rejoin([...loop.slice(first), ...loop.slice(0, first)].map((i) => edges[i])));
  }
  return loops;
}
