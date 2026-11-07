import { pathLengthTable, type CurvePosition, type Path } from '@weasel-js/geom';
import { anchorParamsBetween, type Mesh, polylineAtCurve } from '@weasel-js/geom/tessellate';
import type { StrokeTrim } from '@weasel-js/paint';
import type { MeasuredPolyline } from '../tessellate/dash';
import { expandPolyline, type RibbonOut } from '../tessellate/expandPolyline';
import { emitCap, makeSeg } from '../tessellate/ribbon';
import { ribbonMesh } from '../tessellate/stroke';
import { coordsOutOfMetric } from '../tessellate/metric';
import type { ClipRibbon, ClipSubpath } from './clipRibbon';
import { trimSpan } from './trimSpan';

const EPS = 1e-9;

/** What one trim draws of a {@link ClipRibbon}. */
export interface ClipWindow {
  /** The lengths a fragment must fall between, ends included. */
  from: number;
  to: number;
  /** What the window draws beside the clipped ribbon, where a cut ends it, or `null` for nothing. */
  ends: Mesh | null;
}

/**
 * The window `trim` clips `ribbon` to, `path` being the authored path the
 * ribbon was built from. Null when it draws nothing. It ends where
 * `tessellateStroke` would cut the trimmed run, the run's insets taken, but
 * on the flattening's chord rather than on the curve beside it.
 *
 * A fragment shader decides a whole pixel at its center, so a multisampled
 * edge it cuts is not antialiased the way a triangle's is. Each cut end is
 * drawn as geometry instead, in `ends`: the run's last `2 * seam` up to the
 * cut, with its cap, and the window stops `seam` short of it. A `seam` of a
 * pixel or more puts the shader's edge under that geometry, which overlaps
 * the ribbon there: so the ribbon is to be opaque. Every length, `seam`
 * included, is in the ribbon's measure: its metric's, where it has one.
 */
export function clipWindow(ribbon: ClipRibbon, path: Path, trim: StrokeTrim, seam = 0): ClipWindow | null {
  const span = trimSpan(path, trim);
  const subs = ribbon.subpaths;
  if (!span || subs.length === 0) return null;
  const first = Math.max(span.from.run, 0);
  const last = Math.min(span.to.run, subs.length - 1);
  if (first > last) return null;
  const { runs } = pathLengthTable(path);
  const at = (r: number, pos: CurvePosition | null) => (pos === null ? null
    : inRibbonMeasure(subs[r], polylineAtCurve(subs[r].polyline, pos.segment, pos.t, runs[r]).length));
  const lo = at(first, span.from.run === first ? span.from : null) ?? 0;
  const hi = at(last, span.to.run === last ? span.to : null) ?? subs[last].length;
  if (first === last && hi - lo <= EPS) return null;

  const { margin, startInset, endInset } = ribbon;
  const head = subs[first], tail = subs[last];
  const cutsHead = lo > EPS;
  const cutsTail = tail.length - hi > EPS;
  // Uncut, an end reaches the gap, so the ribbon's own cap and a closed subpath's whole build both show.
  let from = cutsHead ? head.offset + lo + (head.polyline.closed ? 0 : startInset) : head.offset - margin;
  let to = cutsTail ? tail.offset + hi - (tail.polyline.closed ? 0 : endInset) : tail.offset + tail.length + margin;
  if (from >= to) return null;

  const out: RibbonOut = { verts: [], idx: [], anchorA: [], anchorB: [], anchorT: [] };
  const end = (sub: ClipSubpath) => sub.offset + sub.length;
  const reach = Math.max(seam, 0) * 2;
  const headTo = cutsHead ? Math.min(from + reach, end(head), to) : from;
  const tailFrom = cutsTail ? Math.max(to - reach, tail.offset, from) : to;
  if (first === last && cutsHead && cutsTail && headTo >= tailFrom) {
    drawSpan(ribbon, from, to, true, true, out);
    return { from: to + margin, to: from - margin, ends: meshOf(out, path, ribbon) };
  }
  if (cutsHead) {
    drawSpan(ribbon, from, headTo, true, false, out);
    from = Math.min(from + seam, end(head) + margin / 2);
  }
  if (cutsTail) {
    drawSpan(ribbon, tailFrom, to, false, true, out);
    to = Math.max(to - seam, tail.offset - margin / 2);
  }
  return { from, to, ends: meshOf(out, path, ribbon) };
}

function meshOf(out: RibbonOut, path: Path, ribbon: ClipRibbon): Mesh | null {
  if (out.idx.length === 0) return null;
  const mesh = ribbonMesh(out, path);
  if (ribbon.metric) coordsOutOfMetric(mesh.vertices, ribbon.metric);
  return mesh;
}

/** `length`, along `sub`'s world flattening, in the ribbon's measure. */
function inRibbonMeasure(sub: ClipSubpath, length: number): number {
  const m = sub.measure;
  if (m === undefined) return length;
  const { world, ribbon } = m;
  let lo = 0, hi = world.length - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (world[mid] <= length) lo = mid;
    else hi = mid;
  }
  const span = world[hi] - world[lo];
  const f = span > EPS ? Math.min(Math.max((length - world[lo]) / span, 0), 1) : 0;
  return ribbon[lo] + (ribbon[hi] - ribbon[lo]) * f;
}

/**
 * Everything the ribbon strokes between lengths `a` and `b`, with a cap at
 * each piece's own end inside that span and, where `capA` or `capB`, at a cut
 * at `a` or `b`.
 */
function drawSpan(ribbon: ClipRibbon, a: number, b: number, capA: boolean, capB: boolean, out: RibbonOut): void {
  const { pieces, style } = ribbon;
  const butt = { ...style, cap: 'butt' as const };
  for (let k = firstPieceAfter(pieces, a); k < pieces.length; k++) {
    const piece = pieces[k];
    const L = piece.lengths!;
    const p0 = L[0], p1 = L[L.length - 1];
    if (p0 >= b) break;
    const s0 = Math.max(a, p0), s1 = Math.min(b, p1);
    if (s1 < s0) continue;
    if (s1 - s0 > EPS) expandPolyline(sliced(piece, s0, s1), butt, out);
    if (style.cap === 'butt') continue;
    if (s0 === p0 || capA) capAt(piece, s0, false, ribbon, out);
    if (s1 === p1 || capB) capAt(piece, s1, true, ribbon, out);
  }
}

/** The index of the first piece whose lengths run past `s`. */
function firstPieceAfter(pieces: readonly MeasuredPolyline[], s: number): number {
  let lo = 0, hi = pieces.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    const L = pieces[mid].lengths!;
    if (L[L.length - 1] <= s) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}

interface Station { x: number; y: number; w: number; o: number; ux: number; uy: number; a: number; b: number; t: number }

/** Where `piece` is at length `s`, and the chord it is on: the one arriving there, or with `leaving` the one leaving. */
function stationAt(piece: MeasuredPolyline, s: number, leaving: boolean, width: number): Station | null {
  const L = piece.lengths!;
  const p = piece.points;
  let i = 0;
  while (i < L.length - 2 && (leaving ? L[i + 1] <= s : L[i + 1] < s)) i++;
  while (i < L.length - 2 && L[i + 1] - L[i] <= EPS) i++;
  const span = L[i + 1] - L[i];
  if (!(span > EPS)) return null;
  const f = Math.min(Math.max((s - L[i]) / span, 0), 1);
  const lerp = (a: ArrayLike<number>) => a[i] + (a[i + 1] - a[i]) * f;
  const W = piece.widths, O = piece.offsets;
  const A = piece.anchorA, B = piece.anchorB, T = piece.anchorT;
  const [a, b, t] = A && B && T ? anchorParamsBetween(A[i], B[i], T[i], A[i + 1], B[i + 1], T[i + 1], f) : [0, 0, 0];
  return {
    a, b, t,
    x: p[i * 2] + (p[i * 2 + 2] - p[i * 2]) * f,
    y: p[i * 2 + 1] + (p[i * 2 + 3] - p[i * 2 + 1]) * f,
    w: W ? lerp(W) : width,
    o: O ? lerp(O) : 0,
    ux: (p[i * 2 + 2] - p[i * 2]) / span,
    uy: (p[i * 2 + 3] - p[i * 2 + 1]) / span,
  };
}

/** `piece` between lengths `s0` and `s1`, which it runs past. */
function sliced(piece: MeasuredPolyline, s0: number, s1: number): MeasuredPolyline {
  const L = piece.lengths!;
  const p = piece.points;
  const W = piece.widths, O = piece.offsets;
  const A = piece.anchorA, B = piece.anchorB, T = piece.anchorT;
  const points: number[] = [], lengths: number[] = [], widths: number[] = [], offsets: number[] = [];
  const as: number[] = [], bs: number[] = [], ts: number[] = [];
  const push = (x: number, y: number, s: number, w: number, o: number, a: number, b: number, t: number) => {
    points.push(x, y); lengths.push(s); widths.push(w); offsets.push(o); as.push(a); bs.push(b); ts.push(t);
  };
  const first = stationAt(piece, s0, true, 0)!;
  push(first.x, first.y, s0, first.w, first.o, first.a, first.b, first.t);
  for (let i = 0; i < L.length; i++) {
    if (L[i] > s0 + EPS && L[i] < s1 - EPS) {
      push(p[i * 2], p[i * 2 + 1], L[i], W ? W[i] : 0, O ? O[i] : 0, A ? A[i] : 0, B ? B[i] : 0, T ? T[i] : 0);
    }
  }
  const last = stationAt(piece, s1, false, 0)!;
  push(last.x, last.y, s1, last.w, last.o, last.a, last.b, last.t);
  return {
    points, closed: false,
    anchorA: Uint32Array.from(as), anchorB: Uint32Array.from(bs), anchorT: Float32Array.from(ts),
    lengths: Float64Array.from(lengths),
    ...(W ? { widths: Float32Array.from(widths) } : {}),
    ...(O ? { offsets: Float32Array.from(offsets) } : {}),
  };
}

/** A cap at length `s` of `piece`, facing back along the line (`atEnd`) or forward. */
function capAt(piece: MeasuredPolyline, s: number, atEnd: boolean, ribbon: ClipRibbon, out: RibbonOut): void {
  const st = stationAt(piece, s, !atEnd, ribbon.style.width);
  if (!st) return;
  const { x, y, ux, uy } = st;
  const pos = st.w / 2 + st.o, neg = st.w / 2 - st.o;
  const seg = atEnd ? makeSeg(x - ux, y - uy, x, y, pos, neg, pos, neg) : makeSeg(x, y, x + ux, y + uy, pos, neg, pos, neg);
  if (!seg) return;
  const left = out.verts.length / 2;
  out.verts.push(x + seg.nxUnit * pos, y + seg.nyUnit * pos, x - seg.nxUnit * neg, y - seg.nyUnit * neg);
  out.anchorA.push(st.a, st.a); out.anchorB.push(st.b, st.b); out.anchorT.push(st.t, st.t);
  emitCap(seg, left, left + 1, atEnd, pos, neg, ribbon.style.cap, out.verts, out.idx, out.anchorA, out.anchorB, out.anchorT, st.a, st.b, st.t);
}
