/** Rebuilding outlines as the non-crossing boundary of their nonzero fill. */

import { forEachCrossing } from './sweep';

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
 * The boundary of `flat`'s nonzero fill as loops that do not cross, each with
 * the fill on its left, or `null` when no two edges cross and `always` is
 * not set.
 */
export function resolveCrossings(flat: FlattenedContours, always = false): FlattenedContours | null {
  if (!always && !anyCrossing(flat)) return null;
  const edges = edgesOf(flat);
  cutAtCrossings(edges);
  const pieces = boundaryPieces(edges);
  return loopsToContours(chainLoops(pieces));
}

/** Whether any two edges of `flat` cross. Every nonzero fill asks this, and
 *  most cross nowhere, so it reads the coordinates without building edges. */
export function anyCrossing(flat: FlattenedContours): boolean {
  const { coords, contourStarts } = flat;
  const total = coords.length / 2;
  const ends = new Float64Array(total * 4);
  let n = 0;
  contourStarts.forEach((start, c) => {
    const end = c + 1 < contourStarts.length ? contourStarts[c + 1] : total;
    for (let i = start; i < end; i++) {
      const j = i + 1 < end ? i + 1 : start;
      const x0 = coords[i * 2], y0 = coords[i * 2 + 1], x1 = coords[j * 2], y1 = coords[j * 2 + 1];
      if (x0 === x1 && y0 === y1) continue;
      ends[n * 4] = x0; ends[n * 4 + 1] = y0; ends[n * 4 + 2] = x1; ends[n * 4 + 3] = y1;
      n++;
    }
  });
  let found = false;
  forEachCrossing(ends, n, () => (found = true));
  return found;
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

/** Record every interior crossing on both edges it cuts. */
function cutAtCrossings(edges: Edge[]): void {
  const ends = new Float64Array(edges.length * 4);
  edges.forEach(({ from, to }, i) => ends.set([from.x, from.y, to.x, to.y], i * 4));
  forEachCrossing(ends, edges.length, (ei, fi, s, u) => {
    const e = edges[ei];
    const node = {
      x: e.from.x + (e.to.x - e.from.x) * s,
      y: e.from.y + (e.to.y - e.from.y) * s,
      ...anchorsAlong(e, s),
    };
    e.cuts.push({ s, node });
    edges[fi].cuts.push({ s: u, node });
  });
}

/** Anchors for a point `s` of the way along `e`: interpolated within one
 *  curve's run, else the nearer end's. */
function anchorsAlong(e: Edge, s: number): { a: number; b: number; t: number } {
  const { from, to } = e;
  if (from.a === to.a && from.b === to.b) return { a: from.a, b: from.b, t: from.t + (to.t - from.t) * s };
  const near = s < 0.5 ? from : to;
  return { a: near.a, b: near.b, t: near.t };
}

/** The pieces between cuts that have fill on exactly one side, turned so it is on the left. */
function boundaryPieces(edges: Edge[]): Piece[] {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const { from: p } of edges) {
    minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x);
    minY = Math.min(minY, p.y); maxY = Math.max(maxY, p.y);
  }
  const eps = Math.max(Math.hypot(maxX - minX, maxY - minY) * 1e-7, 1e-9);
  const filled = (x: number, y: number) => windingAt(edges, x, y) !== 0;

  const out: Piece[] = [];
  for (const e of edges) {
    const stops = [e.from, ...e.cuts.sort((p, q) => p.s - q.s).map((c) => c.node), e.to];
    for (let k = 0; k + 1 < stops.length; k++) {
      const p = stops[k], q = stops[k + 1];
      const dx = q.x - p.x, dy = q.y - p.y;
      const len = Math.hypot(dx, dy);
      if (len === 0) continue;
      const mx = (p.x + q.x) / 2, my = (p.y + q.y) / 2;
      const nx = (-dy / len) * eps, ny = (dx / len) * eps;
      const left = filled(mx + nx, my + ny), right = filled(mx - nx, my - ny);
      if (left && !right) out.push({ from: p, to: q });
      else if (right && !left) out.push({ from: q, to: p });
    }
  }
  return out;
}

function windingAt(edges: Edge[], x: number, y: number): number {
  let w = 0;
  for (const { from: p, to: q } of edges) {
    const side = (q.x - p.x) * (y - p.y) - (x - p.x) * (q.y - p.y);
    if (p.y <= y && q.y > y && side > 0) w++;
    else if (q.y <= y && p.y > y && side < 0) w--;
  }
  return w;
}

/** Join pieces end to start into closed loops. Where a node has several ways
 *  on, take the sharpest left turn, which keeps to the face being traced. */
function chainLoops(pieces: Piece[]): Node[][] {
  const outgoing = new Map<string, Piece[]>();
  for (const p of pieces) {
    const k = keyOf(p.from);
    const list = outgoing.get(k);
    if (list) list.push(p);
    else outgoing.set(k, [p]);
  }
  const used = new Set<Piece>();
  const loops: Node[][] = [];
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
    if (keyOf(cur.to) === startKey && loop.length >= 3) loops.push(loop);
  }
  return loops;
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
