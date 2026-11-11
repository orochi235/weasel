import type { Polyline } from '@weasel-js/geom/tessellate';
import { type Cap, emitCap, emitJoin, type Join, makeSeg, type Seg } from './ribbon';
import { meetInnerEdges } from './innerJoins';

/** How a ribbon is drawn around its polyline. */
export interface RibbonStyle {
  width: number;
  join: Join;
  cap: Cap;
  miterLimit: number;
  varyingThreshold: number;
  /** Whether the segments of a turn meet along one edge inside it (`innerJoins`), the default,
   *  or each keep their whole quad: which covers the same ground, twice inside the turn. */
  meet?: boolean;
}

/** What {@link expandPolyline} appends to. `lengths`, where present, takes one
 *  arc length per vertex (see {@link expandPolyline}). */
export interface RibbonOut {
  verts: number[];
  idx: number[];
  anchorA: number[];
  anchorB: number[];
  anchorT: number[];
  lengths?: number[];
}

/**
 * Append the ribbon of `pl` to `out`.
 *
 * With `at`, one arc length per point of `pl`, each vertex also gets the arc
 * length a shader clips it by: a segment's own projection onto it, so a cut
 * through the quad is square to it however its corners were moved, and a
 * join's or cap's whole geometry the length of the point it sits at, so it
 * shows exactly while that point does. A join's corners are its own copies
 * then, not the segments'.
 */
export function expandPolyline(pl: Polyline & { tangent?: readonly [number, number] }, style: RibbonStyle, out: RibbonOut, at?: ArrayLike<number>): void {
  const { verts, idx, anchorA, anchorB, anchorT } = out;
  const half = style.width / 2;
  const pts = pl.points;
  const ptCount = pts.length / 2;
  const segCount = ptCount - 1;
  // A lone moveto is never stroked; a closed one is a zero-length subpath, as `M5 5Z` is.
  if (segCount < 1 && !(pl.closed && ptCount === 1)) return;

  // Anchor params per polyline point (set by extractPolylines; splitForDash
  // re-derives them on dash boundaries). Default to A=B=0,t=0 if missing.
  const plA = pl.anchorA ?? new Uint32Array(ptCount);
  const plB = pl.anchorB ?? new Uint32Array(ptCount);
  const plT = pl.anchorT ?? new Float32Array(ptCount);
  // Per-point distance to each edge: derived from pl.widths and pl.offsets
  // if present, else the uniform half. Indexing matches `pts`.
  const W = pl.widths, O = pl.offsets;
  const pos = (i: number) => (W ? W[i] / 2 : half) + (O ? O[i] : 0);
  const neg = (i: number) => (W ? W[i] / 2 : half) - (O ? O[i] : 0);

  const segs: Seg[] = [];
  const segSrcIdx: number[] = [];  // For each seg, the polyline-point index of its start.
  for (let s = 0; s < segCount; s++) {
    const seg = makeSeg(pts[s * 2], pts[s * 2 + 1], pts[(s + 1) * 2], pts[(s + 1) * 2 + 1], pos(s), neg(s), pos(s + 1), neg(s + 1));
    if (seg) {
      segs.push(seg);
      segSrcIdx.push(s);
    }
  }
  let closerSrcIdx = -1;
  if (pl.closed && segs.length >= 1) {
    const last = segs[segs.length - 1];
    const first = segs[0];
    // Closer: from last point back to point 0, with the edges resolved at
    // those source indices.
    const closer = makeSeg(last.bx, last.by, first.ax, first.ay, pos(ptCount - 1), neg(ptCount - 1), pos(0), neg(0));
    if (closer) {
      segs.push(closer);
      closerSrcIdx = ptCount - 1;  // start is the last polyline point.
      segSrcIdx.push(closerSrcIdx);
    }
  }
  if (segs.length === 0) {
    if (style.cap !== 'butt') emitDot(pl, style.cap, pos(0), neg(0), plA[0], plB[0], plT[0], out, at);
    return;
  }

  // Emit ribbon quads. For each emitted vertex, record the (A, B, t) of the
  // source polyline point that the geometric vertex sits at. Per-end
  // half-widths produce trapezoidal segments when the stroke tapers.
  const segBaseIdx: number[] = [];
  for (let s = 0; s < segs.length; s++) {
    const seg = segs[s];
    const startSrc = segSrcIdx[s];
    // End-source index for the seg. For closer (closed-path wraparound), end is point 0.
    const endSrc = (s === segs.length - 1 && pl.closed && closerSrcIdx >= 0) ? 0 : startSrc + 1;
    const base = verts.length / 2;
    segBaseIdx.push(base);
    const { nxUnit: nx, nyUnit: ny } = seg;
    // L0, R0 — at seg.ax/ay, the +n and −n edges.
    verts.push(seg.ax + nx * seg.posA, seg.ay + ny * seg.posA);
    anchorA.push(plA[startSrc]); anchorB.push(plB[startSrc]); anchorT.push(plT[startSrc]);
    verts.push(seg.ax - nx * seg.negA, seg.ay - ny * seg.negA);
    anchorA.push(plA[startSrc]); anchorB.push(plB[startSrc]); anchorT.push(plT[startSrc]);
    // L1, R1 — at seg.bx/by.
    verts.push(seg.bx + nx * seg.posB, seg.by + ny * seg.posB);
    anchorA.push(plA[endSrc]); anchorB.push(plB[endSrc]); anchorT.push(plT[endSrc]);
    verts.push(seg.bx - nx * seg.negB, seg.by - ny * seg.negB);
    anchorA.push(plA[endSrc]); anchorB.push(plB[endSrc]); anchorT.push(plT[endSrc]);
    idx.push(base, base + 1, base + 2, base + 1, base + 3, base + 2);
  }

  // Joins between consecutive segments.
  const joinCount = pl.closed ? segs.length : segs.length - 1;
  const inner = style.meet === false ? new Array<number>(joinCount).fill(-1) : meetInnerEdges(segs, segBaseIdx, pl.closed, verts);
  if (at && out.lengths) projectQuads(segs, segBaseIdx, segSrcIdx, at, verts, out.lengths);
  for (let j = 0; j < joinCount; j++) {
    const mark = markOf(out);
    emitJoin(segs, segBaseIdx, j, style.join, style.miterLimit, style.varyingThreshold, verts, idx, anchorA, anchorB, anchorT, segSrcIdx, plA, plB, plT, inner[j]);
    if (at) ownVertices(out, mark, at[segSrcIdx[(j + 1) % segs.length]]);
  }

  // Caps, from the local edges at each end.
  if (!pl.closed && style.cap !== 'butt') {
    const first = segs[0];
    const firstBase = segBaseIdx[0];
    let mark = markOf(out);
    emitCap(first, firstBase + 0, firstBase + 1, false, first.posA, first.negA, style.cap, verts, idx, anchorA, anchorB, anchorT, plA[0], plB[0], plT[0]);
    if (at) ownVertices(out, mark, at[0], false);

    const last = segs[segs.length - 1];
    const lastBase = segBaseIdx[segs.length - 1];
    const lastSrc = segSrcIdx[segs.length - 1] + 1;
    mark = markOf(out);
    emitCap(last, lastBase + 2, lastBase + 3, true, last.posB, last.negB, style.cap, verts, idx, anchorA, anchorB, anchorT, plA[lastSrc], plB[lastSrc], plT[lastSrc]);
    if (at) ownVertices(out, mark, at[lastSrc], false);
  }
}

interface Mark { vertex: number; index: number }

const markOf = (out: RibbonOut): Mark => ({ vertex: out.verts.length / 2, index: out.idx.length });

/** Each quad vertex's arc length: its segment start's, plus how far along the segment it projects. */
function projectQuads(
  segs: readonly Seg[], segBaseIdx: readonly number[], segSrcIdx: readonly number[],
  at: ArrayLike<number>, verts: readonly number[], lengths: number[],
): void {
  for (let s = 0; s < segs.length; s++) {
    const seg = segs[s];
    const ux = (seg.bx - seg.ax) / seg.len, uy = (seg.by - seg.ay) / seg.len;
    const s0 = at[segSrcIdx[s]];
    for (let k = 0; k < 4; k++) {
      const v = segBaseIdx[s] + k;
      lengths[v] = s0 + (verts[v * 2] - seg.ax) * ux + (verts[v * 2 + 1] - seg.ay) * uy;
    }
  }
}

/**
 * Give everything emitted since `mark` the arc length `s`. With `copy`, the
 * older vertices its triangles reach are first copied, so that length does not
 * overwrite the quads' own.
 */
function ownVertices(out: RibbonOut, mark: Mark, s: number, copy = true): void {
  const { verts, idx, anchorA, anchorB, anchorT } = out;
  const lengths = out.lengths!;
  if (copy) {
    const copies = new Map<number, number>();
    for (let i = mark.index; i < idx.length; i++) {
      const v = idx[i];
      if (v >= mark.vertex) continue;
      let c = copies.get(v);
      if (c === undefined) {
        c = verts.length / 2;
        verts.push(verts[v * 2], verts[v * 2 + 1]);
        anchorA.push(anchorA[v]); anchorB.push(anchorB[v]); anchorT.push(anchorT[v]);
        copies.set(v, c);
      }
      idx[i] = c;
    }
  }
  for (let v = mark.vertex; v < verts.length / 2; v++) lengths[v] = s;
}

/**
 * The caps of a polyline that never leaves its first point, open or closed, which SVG
 * strokes for a round or square cap: a disc, or a square turned to `tangent`,
 * the direction of the line a zero-length dash was cut from, or else the x axis.
 */
function emitDot(
  pl: Polyline & { tangent?: readonly [number, number] }, cap: Cap, pos: number, neg: number,
  a: number, b: number, t: number, out: RibbonOut, at?: ArrayLike<number>,
): void {
  const { verts, idx, anchorA, anchorB, anchorT } = out;
  const x = pl.points[0], y = pl.points[1];
  const [tx, ty] = pl.tangent ?? [1, 0];
  const mark = markOf(out);
  const left = verts.length / 2;
  verts.push(x - ty * pos, y + tx * pos, x + ty * neg, y - tx * neg);
  anchorA.push(a, a); anchorB.push(b, b); anchorT.push(t, t);
  // A unit step vanishes beside a coordinate past 2^53; one scaled to it stays a fraction of it.
  const step = Math.max(1, Math.abs(x), Math.abs(y)) * 2 ** -20;
  const ahead = makeSeg(x, y, x + tx * step, y + ty * step, pos, neg, pos, neg)!;
  const behind = makeSeg(x - tx * step, y - ty * step, x, y, pos, neg, pos, neg)!;
  emitCap(ahead, left, left + 1, false, pos, neg, cap, verts, idx, anchorA, anchorB, anchorT, a, b, t);
  emitCap(behind, left, left + 1, true, pos, neg, cap, verts, idx, anchorA, anchorB, anchorT, a, b, t);
  if (at && out.lengths) ownVertices(out, mark, at[0], false);
}
