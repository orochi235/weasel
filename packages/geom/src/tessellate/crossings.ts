/** Rebuilding outlines as the non-crossing boundary of their fill. */

import { forEachCrossing } from './sweep';
import { lerp } from '../scalar';
import { anchorParamsBetween } from './anchorParams';
import { anyContact } from './evenOdd';
import { nestRings, type Ring } from './nesting';

/** Flattened contours with each vertex's anchor parameterization. */
export interface FlattenedContours {
  coords: number[];
  contourStarts: number[];
  anchorA: number[];
  anchorB: number[];
  anchorT: number[];
}

interface Node {
  x: number;
  y: number;
  a: number;
  b: number;
  t: number;
}

interface Edge {
  from: Node;
  to: Node;
  /** Where crossings cut this edge, by parameter along it. */
  cuts: { s: number; node: Node }[];
}

interface Piece {
  from: Node;
  to: Node;
}

const keyOf = (n: Node): string => `${n.x},${n.y}`;

/**
 * Contours drawing `flat`'s nonzero fill that triangulate ring by ring, with
 * their rings: `flat` itself when no two edges meet and nothing winds past 1,
 * else the fill's boundary as loops that neither cross nor overlap. `flat`
 * too, unresolved, when that boundary would not close into loops.
 */
export function nonzeroContours(flat: FlattenedContours): { contours: FlattenedContours; rings: Ring[] } {
  if (!anyContact(flat)) {
    const rings = nestRings(flat);
    if (rings.every((r) => Math.abs(r.winding) <= 1)) return { contours: flat, rings };
  }
  const out = resolve(flat, (w) => w !== 0)!;
  const contours = out.complete ? out.contours : flat;
  return { contours, rings: nestRings(contours) };
}

/**
 * How much work resolving an even-odd fill may take, as boundary pieces times
 * edges: each piece is judged by a winding count over every edge. 2^20 of it
 * took 10 ms on an Apple M-series core (1024 edges, 2026-10-31), and parity is
 * what the stencil computes for free, so a fill past it keeps the stencil.
 */
export const MAX_EVENODD_RESOLVE_WORK = 2 ** 20;

/**
 * The boundary of `flat`'s even-odd fill as loops that neither cross nor
 * overlap, each with the fill on its left, for outlines that cross or touch.
 * `null` when resolving would pass {@link MAX_EVENODD_RESOLVE_WORK}, or a
 * boundary piece would not close into a loop.
 */
export function resolveEvenOdd(flat: FlattenedContours): FlattenedContours | null {
  const edges = edgeCount(flat);
  const maxCrossings = Math.floor((MAX_EVENODD_RESOLVE_WORK / edges - edges) / 2);
  if (!(maxCrossings >= 0)) return null;
  const out = resolve(flat, (w) => (w & 1) !== 0, maxCrossings);
  return out !== null && out.complete ? out.contours : null;
}

function resolve(
  flat: FlattenedContours, filled: (winding: number) => boolean, maxCrossings = Infinity,
): { contours: FlattenedContours; complete: boolean } | null {
  const edges = edgesOf(flat);
  const eps = contactTolerance(edges);
  if (!cutAtCrossings(edges, maxCrossings)) return null;
  cutAtContacts(edges, eps);
  weld(edges, eps);
  const pieces = boundaryPieces(edges, filled, eps);
  const { loops, complete } = chainLoops(pieces);
  return { contours: loopsToContours(loops), complete };
}

function edgeCount(flat: FlattenedContours): number {
  const { coords, contourStarts } = flat;
  const total = coords.length / 2;
  let n = 0;
  contourStarts.forEach((start, c) => {
    const end = c + 1 < contourStarts.length ? contourStarts[c + 1] : total;
    for (let i = start; i < end; i++) {
      const j = i + 1 < end ? i + 1 : start;
      if (coords[i * 2] !== coords[j * 2] || coords[i * 2 + 1] !== coords[j * 2 + 1]) n++;
    }
  });
  return n;
}

function edgesOf(flat: FlattenedContours): Edge[] {
  const { coords, contourStarts, anchorA, anchorB, anchorT } = flat;
  const total = coords.length / 2;
  const node = (i: number): Node => ({ x: coords[i * 2], y: coords[i * 2 + 1], a: anchorA[i], b: anchorB[i], t: anchorT[i] });
  const edges: Edge[] = [];
  contourStarts.forEach((start, c) => {
    const end = c + 1 < contourStarts.length ? contourStarts[c + 1] : total;
    for (let i = start; i < end; i++) {
      const from = node(i), to = node(i + 1 < end ? i + 1 : start);
      if (from.x !== to.x || from.y !== to.y) edges.push({ from, to, cuts: [] });
    }
  });
  return edges;
}

/** Record every interior crossing on both edges it cuts. `false`, having
 *  stopped, when there are more than `max`. */
function cutAtCrossings(edges: Edge[], max: number): boolean {
  const ends = new Float64Array(edges.length * 4);
  edges.forEach(({ from, to }, i) => ends.set([from.x, from.y, to.x, to.y], i * 4));
  let count = 0;
  forEachCrossing(ends, edges.length, (ei, fi, s, u) => {
    if (++count > max) return true;
    const e = edges[ei];
    const node = {
      x: lerp(e.from.x, e.to.x, s),
      y: lerp(e.from.y, e.to.y, s),
      ...anchorsAlong(e, s),
    };
    e.cuts.push({ s, node });
    edges[fi].cuts.push({ s: u, node });
    return false;
  });
  return count <= max;
}

/**
 * Cut every edge where another's end lies inside it, so outlines that touch
 * without crossing (a corner on an edge, a stretch of edge two contours share)
 * meet at a node both name. The cut takes the touching end's own coordinates,
 * so the two sides of a shared stretch come out as the same pieces.
 */
function cutAtContacts(edges: Edge[], eps: number): void {
  const order = edges.map((_, i) => i);
  const lo = (e: Edge): number => Math.min(e.from.x, e.to.x);
  order.sort((a, b) => lo(edges[a]) - lo(edges[b]));
  for (let a = 0; a < order.length; a++) {
    const e = edges[order[a]];
    const stop = Math.max(e.from.x, e.to.x) + eps;
    for (let b = a + 1; b < order.length; b++) {
      const f = edges[order[b]];
      if (lo(f) > stop) break;
      if (Math.max(e.from.y, e.to.y) + eps < Math.min(f.from.y, f.to.y)) continue;
      if (Math.max(f.from.y, f.to.y) + eps < Math.min(e.from.y, e.to.y)) continue;
      cutAt(e, f.from, eps); cutAt(e, f.to, eps);
      cutAt(f, e.from, eps); cutAt(f, e.to, eps);
    }
  }
}

/** How near two points are to count as touching: the tolerance
 *  `evenOddRings` judges contact by. */
function contactTolerance(edges: Edge[]): number {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const { from: p } of edges) {
    minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x);
    minY = Math.min(minY, p.y); maxY = Math.max(maxY, p.y);
  }
  return Math.max(maxX - minX, maxY - minY, Math.abs(minX), Math.abs(maxX), Math.abs(minY), Math.abs(maxY)) * 1e-9;
}

/** Move every node within `eps` of one before it onto that one, so loops
 *  chain through points that differ only by rounding. */
function weld(edges: Edge[], eps: number): void {
  const nodes: Node[] = [];
  for (const e of edges) {
    nodes.push(e.from, e.to);
    for (const c of e.cuts) nodes.push(c.node);
  }
  nodes.sort((p, q) => p.x - q.x);
  for (let i = 0; i < nodes.length; i++) {
    const p = nodes[i];
    for (let j = i + 1; j < nodes.length && nodes[j].x - p.x <= eps; j++) {
      const q = nodes[j];
      if (q !== p && Math.abs(q.y - p.y) <= eps && (q.x !== p.x || q.y !== p.y)) {
        q.x = p.x;
        q.y = p.y;
      }
    }
  }
}

/** Cut `e` at `p` when `p` lies within `eps` of its inside, away from its ends
 *  and from any cut already there. */
function cutAt(e: Edge, p: Node, eps: number): void {
  const dx = e.to.x - e.from.x, dy = e.to.y - e.from.y;
  const len2 = dx * dx + dy * dy;
  const s = ((p.x - e.from.x) * dx + (p.y - e.from.y) * dy) / len2;
  if (!(s > 0 && s < 1)) return;
  if (Math.hypot(e.from.x + dx * s - p.x, e.from.y + dy * s - p.y) > eps) return;
  const at = (q: Node): boolean => Math.abs(q.x - p.x) <= eps && Math.abs(q.y - p.y) <= eps;
  if (at(e.from) || at(e.to) || e.cuts.some((c) => at(c.node))) return;
  e.cuts.push({ s, node: p });
}

/** Anchors for a point `s` of the way along `e`. */
function anchorsAlong(e: Edge, s: number): { a: number; b: number; t: number } {
  const { from, to } = e;
  const [a, b, t] = anchorParamsBetween(from.a, from.b, from.t, to.a, to.b, to.t, s);
  return { a, b, t };
}

/** The pieces between cuts that have fill on exactly one side, turned so it
 *  is on the left. A stretch two edges share comes out once. */
function boundaryPieces(edges: Edge[], filledBy: (winding: number) => boolean, eps: number): Piece[] {
  const out: Piece[] = [];
  const seen = new Set<string>();
  const keep = (from: Node, to: Node): void => {
    const k = `${keyOf(from)}>${keyOf(to)}`;
    if (seen.has(k)) return;
    seen.add(k);
    out.push({ from, to });
  };
  for (const e of edges) {
    const stops = [e.from, ...e.cuts.sort((p, q) => p.s - q.s).map((c) => c.node), e.to];
    for (let k = 0; k + 1 < stops.length; k++) {
      const p = stops[k], q = stops[k + 1];
      const len = Math.hypot(q.x - p.x, q.y - p.y);
      if (len === 0) continue;
      const w = windingBeside(edges, (p.x + q.x) / 2, (p.y + q.y) / 2, (q.x - p.x) / len, (q.y - p.y) / len, eps);
      const left = filledBy(w.left), right = filledBy(w.left - w.along);
      if (left && !right) keep(p, q);
      else if (right && !left) keep(q, p);
    }
  }
  return out;
}

/**
 * The winding number just left of a point `m` on the outline, where it runs
 * in direction `d`, and how much it drops crossing to the right: the edges
 * lying along `d` through `m`, each +1 running with it and -1 against. Counted
 * on a ray from `m` along the left normal, not at a point offset from `m`,
 * which a sliver or spike narrower than the offset would put past another edge.
 */
function windingBeside(
  edges: Edge[], mx: number, my: number, dx: number, dy: number, eps: number,
): { left: number; along: number } {
  // A frame with `m` at the origin, the ray along +u and v = -d.
  const u = (x: number, y: number) => (x - mx) * -dy + (y - my) * dx;
  const v = (x: number, y: number) => -((x - mx) * dx + (y - my) * dy);
  let left = 0, along = 0;
  for (const { from, to } of edges) {
    const pu = u(from.x, from.y), pv = v(from.x, from.y);
    const qu = u(to.x, to.y), qv = v(to.x, to.y);
    if (Math.abs(pu) <= eps && Math.abs(qu) <= eps) {
      if (Math.min(pv, qv) < 0 && Math.max(pv, qv) > 0) along += qv < pv ? 1 : -1;
      continue;
    }
    const side = (qu - pu) * -pv + pu * (qv - pv);
    if (pv <= 0 && qv > 0 && side > 0) left++;
    else if (qv <= 0 && pv > 0 && side < 0) left--;
  }
  return { left, along };
}

/** Join pieces end to start into closed loops. Where a node has several ways
 *  on, take the sharpest left turn, which keeps to the face being traced. */
function chainLoops(pieces: Piece[]): { loops: Node[][]; complete: boolean } {
  const outgoing = new Map<string, Piece[]>();
  for (const p of pieces) {
    const k = keyOf(p.from);
    const list = outgoing.get(k);
    if (list) list.push(p);
    else outgoing.set(k, [p]);
  }
  const used = new Set<Piece>();
  const loops: Node[][] = [];
  let complete = true;
  for (const first of pieces) {
    if (used.has(first)) continue;
    used.add(first);
    const loop: Node[] = [first.from];
    const startKey = keyOf(first.from);
    let cur = first;
    while (keyOf(cur.to) !== startKey) {
      const next = sharpestLeft(cur, (outgoing.get(keyOf(cur.to)) ?? []).filter((p) => !used.has(p)));
      if (!next) break;
      used.add(next);
      loop.push(next.from);
      cur = next;
    }
    if (keyOf(cur.to) !== startKey) complete = false;
    else if (loop.length >= 3) loops.push(loop);
  }
  return { loops, complete };
}

function sharpestLeft(into: Piece, options: Piece[]): Piece | undefined {
  const ix = into.to.x - into.from.x, iy = into.to.y - into.from.y;
  let best: Piece | undefined;
  let bestTurn = -Infinity;
  for (const p of options) {
    const ox = p.to.x - p.from.x, oy = p.to.y - p.from.y;
    const turn = Math.atan2(ix * oy - iy * ox, ix * ox + iy * oy);
    if (turn > bestTurn) {
      bestTurn = turn;
      best = p;
    }
  }
  return best;
}

function loopsToContours(loops: Node[][]): FlattenedContours {
  const out: FlattenedContours = { coords: [], contourStarts: [], anchorA: [], anchorB: [], anchorT: [] };
  for (const loop of loops) {
    out.contourStarts.push(out.coords.length / 2);
    for (const n of loop) {
      out.coords.push(n.x, n.y);
      out.anchorA.push(n.a);
      out.anchorB.push(n.b);
      out.anchorT.push(n.t);
    }
  }
  return out;
}
