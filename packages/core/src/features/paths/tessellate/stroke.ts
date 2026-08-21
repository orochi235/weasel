import type { Path, Stroke } from '@weasel-js/core';
import { alignedStrokeRect } from '@weasel-js/core';
import type { Mesh } from '../../../renderer/cache/mesh';
import { extractPolylines, type Polyline } from './polyline';

/** Options for stroke tessellation. */
export interface StrokeOptions {
  flattenTolerance?: number;
}

const EMPTY_MESH: Mesh = {
  vertices: new Float32Array(0),
  indices: new Uint32Array(0),
  anchorA: new Uint32Array(0),
  anchorB: new Uint32Array(0),
  anchorT: new Float32Array(0),
};

type Cap = 'butt' | 'round' | 'square';
type Join = 'miter' | 'round' | 'bevel';

/** Per-segment data the join code needs. */
interface Seg {
  ax: number; ay: number;
  bx: number; by: number;
  /** Unit perpendicular (rotated 90° CCW from direction). */
  nxUnit: number; nyUnit: number;
  /** Half-width at the start (a) and end (b) endpoints. Equal for uniform
   *  strokes; differ when the polyline carries per-point widths. */
  halfA: number; halfB: number;
  len: number;
}

/**
 * Build a triangle-mesh ribbon from a stroked Path.
 *
 * Supports:
 *   - cap: 'butt' | 'round' | 'square'
 *   - join: 'miter' | 'round' | 'bevel'
 *   - center alignment directly; RectPath inner/outer alignment via a
 *     pre-shifted rect; PolygonPath inner/outer alignment via stencil at the
 *     renderer level
 *   - dash splitting
 */
export function tessellateStroke(
  path: Path,
  stroke: Stroke,
  opts: StrokeOptions = {},
): Mesh {
  const width = stroke.width ?? 1;
  if (width <= 0) return EMPTY_MESH;
  const join: Join = stroke.join ?? 'miter';
  const cap: Cap = stroke.cap ?? 'butt';
  const align = stroke.align ?? 'center';
  const miterLimit = stroke.miterLimit ?? DEFAULT_MITER_LIMIT;
  const varyingThreshold = stroke.varyingWidthJoinThreshold ?? DEFAULT_VARYING_WIDTH_JOIN_THRESHOLD;

  // RectPath fast path for inner/outer alignment: shift the rect by half-width
  // so the ribbon's center alignment lands the stroke on the desired side of
  // the original geometric edge. Arbitrary paths handle alignment via stencil
  // clipping at the renderer level (not here).
  let workingPath = path;
  if (path.kind === 'rect' && align !== 'center') {
    const aligned = alignedStrokeRect(path, align, width);
    workingPath = {
      kind: 'rect',
      x: aligned.x,
      y: aligned.y,
      width: aligned.width,
      height: aligned.height,
    };
  }

  const polylines = extractPolylines(workingPath, opts);
  // Derive per-polyline-point widths by lerping vertexWidths across
  // anchor pairs using each point's anchorT. When vertexWidths is absent
  // or invalid (length mismatch / non-finite values), polyline.widths is
  // left undefined and the uniform-width fast path runs.
  if (stroke.vertexWidths && stroke.vertexWidths.length > 0) {
    for (const pl of polylines) populatePolylineWidths(pl, stroke.vertexWidths, width);
  }
  const dash = stroke.dash ?? [];
  const verts: number[] = [];
  const idx: number[] = [];
  const anchorA: number[] = [];
  const anchorB: number[] = [];
  const anchorT: number[] = [];

  for (const pl of polylines) {
    const subs = dash.length > 0 ? splitForDash(pl, dash) : [pl];
    for (const sub of subs) {
      expandPolyline(sub, width, join, cap, miterLimit, varyingThreshold, verts, idx, anchorA, anchorB, anchorT);
    }
  }

  return {
    vertices: new Float32Array(verts),
    indices: new Uint32Array(idx),
    anchorA: new Uint32Array(anchorA),
    anchorB: new Uint32Array(anchorB),
    anchorT: new Float32Array(anchorT),
  };
}

function expandPolyline(
  pl: Polyline,
  width: number,
  join: Join,
  cap: Cap,
  miterLimit: number,
  varyingThreshold: number,
  verts: number[],
  idx: number[],
  anchorA: number[],
  anchorB: number[],
  anchorT: number[],
): void {
  const half = width / 2;
  const pts = pl.points;
  const ptCount = pts.length / 2;
  const segCount = ptCount - 1;
  if (segCount < 1) return;

  // Anchor params per polyline point (set by extractPolylines; splitForDash
  // re-derives them on dash boundaries). Default to A=B=0,t=0 if missing.
  const plA = pl.anchorA ?? new Uint32Array(ptCount);
  const plB = pl.anchorB ?? new Uint32Array(ptCount);
  const plT = pl.anchorT ?? new Float32Array(ptCount);
  // Per-point half-widths: derived from pl.widths if present, else the
  // uniform half. Indexing matches `pts` (one entry per polyline point).
  const plHalf = pl.widths
    ? pl.widths.map((w) => w / 2)
    : null;

  const segs: Seg[] = [];
  const segSrcIdx: number[] = [];  // For each seg, the polyline-point index of its start.
  for (let s = 0; s < segCount; s++) {
    const ha = plHalf ? plHalf[s] : half;
    const hb = plHalf ? plHalf[s + 1] : half;
    const seg = makeSeg(pts[s * 2], pts[s * 2 + 1], pts[(s + 1) * 2], pts[(s + 1) * 2 + 1], ha, hb);
    if (seg) {
      segs.push(seg);
      segSrcIdx.push(s);
    }
  }
  let closerSrcIdx = -1;
  if (pl.closed && segs.length >= 1) {
    const last = segs[segs.length - 1];
    const first = segs[0];
    // Closer: from last point back to point 0. Half-widths are the
    // already-resolved ones at those source indices.
    const haCloser = plHalf ? plHalf[ptCount - 1] : half;
    const hbCloser = plHalf ? plHalf[0] : half;
    const closer = makeSeg(last.bx, last.by, first.ax, first.ay, haCloser, hbCloser);
    if (closer) {
      segs.push(closer);
      closerSrcIdx = ptCount - 1;  // start is the last polyline point.
      segSrcIdx.push(closerSrcIdx);
    }
  }
  if (segs.length === 0) return;

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
    const nxA = seg.nxUnit * seg.halfA, nyA = seg.nyUnit * seg.halfA;
    const nxB = seg.nxUnit * seg.halfB, nyB = seg.nyUnit * seg.halfB;
    // L0, R0 — at seg.ax/ay with start half-width.
    verts.push(seg.ax + nxA, seg.ay + nyA);
    anchorA.push(plA[startSrc]); anchorB.push(plB[startSrc]); anchorT.push(plT[startSrc]);
    verts.push(seg.ax - nxA, seg.ay - nyA);
    anchorA.push(plA[startSrc]); anchorB.push(plB[startSrc]); anchorT.push(plT[startSrc]);
    // L1, R1 — at seg.bx/by with end half-width.
    verts.push(seg.bx + nxB, seg.by + nyB);
    anchorA.push(plA[endSrc]); anchorB.push(plB[endSrc]); anchorT.push(plT[endSrc]);
    verts.push(seg.bx - nxB, seg.by - nyB);
    anchorA.push(plA[endSrc]); anchorB.push(plB[endSrc]); anchorT.push(plT[endSrc]);
    idx.push(base, base + 1, base + 2, base + 1, base + 3, base + 2);
  }

  // Joins between consecutive segments.
  const joinCount = pl.closed ? segs.length : segs.length - 1;
  for (let j = 0; j < joinCount; j++) {
    emitJoin(segs, segBaseIdx, j, join, miterLimit, varyingThreshold, verts, idx, anchorA, anchorB, anchorT, segSrcIdx, plA, plB, plT);
  }

  // Caps. Use the local half-width at the cap end (seg.halfA at start, seg.halfB at end).
  if (!pl.closed && cap !== 'butt') {
    const first = segs[0];
    const firstBase = segBaseIdx[0];
    emitCap(first, firstBase + 0, firstBase + 1, false, first.halfA, cap, verts, idx, anchorA, anchorB, anchorT, plA[0], plB[0], plT[0]);

    const last = segs[segs.length - 1];
    const lastBase = segBaseIdx[segs.length - 1];
    const lastSrc = segSrcIdx[segs.length - 1] + 1;
    emitCap(last, lastBase + 2, lastBase + 3, true, last.halfB, cap, verts, idx, anchorA, anchorB, anchorT, plA[lastSrc], plB[lastSrc], plT[lastSrc]);
  }
}

/** Fill `pl.widths` by interpolating `vertexWidths` across each point's
 *  (anchorA, anchorB, anchorT). Anchor-aligned points (A === B) read the
 *  anchor's value directly. Out-of-range / non-finite anchor entries fall
 *  back to `fallbackWidth`. */
function populatePolylineWidths(
  pl: Polyline,
  vertexWidths: number[],
  fallbackWidth: number,
): void {
  const ptCount = pl.points.length / 2;
  if (ptCount === 0) return;
  const aA = pl.anchorA ?? new Uint32Array(ptCount);
  const aB = pl.anchorB ?? new Uint32Array(ptCount);
  const aT = pl.anchorT ?? new Float32Array(ptCount);
  const widths = new Float32Array(ptCount);
  const read = (i: number): number => {
    const v = vertexWidths[i];
    return typeof v === 'number' && isFinite(v) && v > 0 ? v : fallbackWidth;
  };
  for (let i = 0; i < ptCount; i++) {
    const a = aA[i], b = aB[i], t = aT[i];
    if (a === b) {
      widths[i] = read(a);
    } else {
      const wa = read(a);
      const wb = read(b);
      widths[i] = wa + (wb - wa) * t;
    }
  }
  pl.widths = widths;
}

const ROUND_CAP_STEP_RAD = (10 * Math.PI) / 180;

/**
 * Emit a cap at one end of a segment. `leftIdx`/`rightIdx` are the buffer
 * indices of the L (perpendicular +n) and R (perpendicular -n) vertices at
 * the segment endpoint where the cap attaches. `atEnd` chooses which end of
 * the segment to extend from (and which cap-direction sign to use).
 */
function emitCap(
  seg: Seg, leftIdx: number, rightIdx: number, atEnd: boolean,
  half: number, cap: Cap,
  verts: number[], idx: number[],
  anchorA: number[], anchorB: number[], anchorT: number[],
  endA: number, endB: number, endT: number,
): void {
  // Outward direction = forward at end, backward at start.
  const sign = atEnd ? 1 : -1;
  const dx = (seg.bx - seg.ax) / seg.len * sign;
  const dy = (seg.by - seg.ay) / seg.len * sign;
  const cx = atEnd ? seg.bx : seg.ax;
  const cy = atEnd ? seg.by : seg.ay;

  // Perpendicular offset at this cap end uses the local half-width
  // (varies along the polyline when vertexWidths is set).
  const nx = seg.nxUnit * half;
  const ny = seg.nyUnit * half;

  if (cap === 'square') {
    const ox = cx + dx * half;
    const oy = cy + dy * half;
    const lOut = verts.length / 2;
    verts.push(ox + nx, oy + ny);
    anchorA.push(endA); anchorB.push(endB); anchorT.push(endT);
    const rOut = verts.length / 2;
    verts.push(ox - nx, oy - ny);
    anchorA.push(endA); anchorB.push(endB); anchorT.push(endT);
    // Two triangles forming the cap rectangle. Wind so triangles are CCW
    // viewed from the front; orientation symmetric for start vs. end caps.
    if (atEnd) {
      idx.push(leftIdx, lOut, rOut, leftIdx, rOut, rightIdx);
    } else {
      idx.push(leftIdx, rOut, lOut, leftIdx, rightIdx, rOut);
    }
    return;
  }

  if (cap === 'round') {
    // Pivot vertex at the endpoint center; fan from L through the outward
    // 180° arc to R.
    const pivotIdx = verts.length / 2;
    verts.push(cx, cy);
    anchorA.push(endA); anchorB.push(endB); anchorT.push(endT);

    // Starting angle: direction from pivot to L (= +n direction).
    const startAngle = Math.atan2(ny, nx);
    // Sweep 180° toward the outward direction. The outward unit is (dx, dy);
    // we rotate from +n to -n the "outward" way. The dot product of (dx, dy)
    // with the perpendicular tells us which way around the arc to go.
    // A start-cap (sign = -1) sweeps backward; end-cap (sign = +1) sweeps forward.
    const sweep = atEnd ? -Math.PI : Math.PI;
    const steps = Math.max(1, Math.ceil(Math.abs(sweep) / ROUND_CAP_STEP_RAD));
    const stepAngle = sweep / steps;

    let prevIdx = leftIdx;
    for (let i = 1; i < steps; i++) {
      const ang = startAngle + i * stepAngle;
      const fx = cx + Math.cos(ang) * half;
      const fy = cy + Math.sin(ang) * half;
      const newIdx = verts.length / 2;
      verts.push(fx, fy);
      anchorA.push(endA); anchorB.push(endB); anchorT.push(endT);
      if (atEnd) idx.push(prevIdx, newIdx, pivotIdx);
      else       idx.push(prevIdx, pivotIdx, newIdx);
      prevIdx = newIdx;
    }
    if (atEnd) idx.push(prevIdx, rightIdx, pivotIdx);
    else       idx.push(prevIdx, pivotIdx, rightIdx);
  }
}

/**
 * Split a polyline into open sub-polylines for the "on" portions of a dash
 * pattern. Each output sub-polyline gets caps from the stroke's `cap` setting.
 * The "off" portions become invisible gaps. Anchor params are carried through:
 * sub-polyline endpoints inherit their source polyline-point's anchor params;
 * dash boundaries that land mid-segment (between two polyline points) snap
 * their anchor params to whichever endpoint they're closer to when the
 * segment crosses a path-anchor boundary, otherwise interpolate `t` linearly.
 */
function splitForDash(pl: Polyline, dash: number[]): Polyline[] {
  const out: Polyline[] = [];
  const plA = pl.anchorA ?? new Uint32Array(pl.points.length / 2);
  const plB = pl.anchorB ?? new Uint32Array(pl.points.length / 2);
  const plT = pl.anchorT ?? new Float32Array(pl.points.length / 2);

  let dashIdx = 0;
  let dashRemaining = dash[0];
  let onPhase = true;
  let curPts: number[] | null = onPhase ? [pl.points[0], pl.points[1]] : null;
  let curA: number[] | null = onPhase ? [plA[0]] : null;
  let curB: number[] | null = onPhase ? [plB[0]] : null;
  let curT: number[] | null = onPhase ? [plT[0]] : null;

  const flushAndAdvance = () => {
    if (curPts && curPts.length >= 4) {
      out.push({
        points: curPts,
        closed: false,
        anchorA: new Uint32Array(curA!),
        anchorB: new Uint32Array(curB!),
        anchorT: new Float32Array(curT!),
      });
    }
    curPts = null; curA = null; curB = null; curT = null;
    dashIdx = (dashIdx + 1) % dash.length;
    dashRemaining = dash[dashIdx];
    onPhase = !onPhase;
  };

  let prevX = pl.points[0], prevY = pl.points[1];
  const ptCount = pl.points.length / 2;
  const segCount = pl.closed ? ptCount : ptCount - 1;

  for (let i = 0; i < segCount; i++) {
    const nextIdx = (i + 1) % ptCount;
    const cx = pl.points[nextIdx * 2], cy = pl.points[nextIdx * 2 + 1];
    const startA = plA[i], startB = plB[i], startT = plT[i];
    const endA = plA[nextIdx], endB = plB[nextIdx], endT = plT[nextIdx];
    const segFullDx = cx - prevX, segFullDy = cy - prevY;
    const segFullLen = Math.hypot(segFullDx, segFullDy);
    let segDx = segFullDx, segDy = segFullDy;
    let segLen = segFullLen;
    let traveled = 0;

    while (segLen > 1e-9) {
      if (segLen <= dashRemaining) {
        if (onPhase && curPts) {
          curPts.push(cx, cy);
          curA!.push(endA); curB!.push(endB); curT!.push(endT);
        }
        dashRemaining -= segLen;
        prevX = cx; prevY = cy;
        traveled = segFullLen;
        segLen = 0;
        if (dashRemaining <= 1e-9) {
          flushAndAdvance();
          if (onPhase) {
            curPts = [prevX, prevY];
            curA = [endA]; curB = [endB]; curT = [endT];
          }
        }
      } else {
        const tConsume = dashRemaining / segLen;
        const ix = prevX + segDx * tConsume;
        const iy = prevY + segDy * tConsume;
        traveled += dashRemaining;
        const frac = traveled / segFullLen;
        let mA: number, mB: number, mT: number;
        if (startA === endA && startB === endB) {
          mA = startA; mB = startB;
          mT = startT + (endT - startT) * frac;
        } else {
          // Cross-anchor segment: pick the nearer endpoint's params.
          if (frac < 0.5) { mA = startA; mB = startB; mT = startT; }
          else            { mA = endA; mB = endB; mT = endT; }
        }
        if (onPhase && curPts) {
          curPts.push(ix, iy);
          curA!.push(mA); curB!.push(mB); curT!.push(mT);
        }
        prevX = ix; prevY = iy;
        segDx = cx - prevX; segDy = cy - prevY;
        segLen = Math.hypot(segDx, segDy);
        flushAndAdvance();
        if (onPhase) {
          curPts = [prevX, prevY];
          curA = [mA]; curB = [mB]; curT = [mT];
        }
      }
    }
  }

  if (curPts && curPts.length >= 4) {
    out.push({
      points: curPts,
      closed: false,
      anchorA: new Uint32Array(curA!),
      anchorB: new Uint32Array(curB!),
      anchorT: new Float32Array(curT!),
    });
  }
  return out;
}

function makeSeg(ax: number, ay: number, bx: number, by: number, halfA: number, halfB: number): Seg | null {
  const dx = bx - ax, dy = by - ay;
  const len = Math.hypot(dx, dy);
  if (len === 0) return null;
  return {
    ax, ay, bx, by,
    nxUnit: -dy / len, nyUnit: dx / len,
    halfA, halfB,
    len,
  };
}

/** Canvas2D's default miter limit; used when `Stroke.miterLimit` is unset. */
const DEFAULT_MITER_LIMIT = 10;
/** Default `Stroke.varyingWidthJoinThreshold`. */
const DEFAULT_VARYING_WIDTH_JOIN_THRESHOLD = 1.5;

function emitJoin(
  segs: Seg[], segBaseIdx: number[], j: number, join: Join,
  miterLimit: number,
  varyingThreshold: number,
  verts: number[], idx: number[],
  anchorA: number[], anchorB: number[], anchorT: number[],
  segSrcIdx: number[],
  plA: Uint32Array, plB: Uint32Array, plT: Float32Array,
): void {
  const a = segs[j];
  const b = segs[(j + 1) % segs.length];
  const aBase = segBaseIdx[j];
  const bBase = segBaseIdx[(j + 1) % segs.length];

  const adx = a.bx - a.ax, ady = a.by - a.ay;
  const bdx = b.bx - b.ax, bdy = b.by - b.ay;
  const cross = adx * bdy - ady * bdx;
  if (cross === 0) return;                                       // straight (collinear), no wedge
  const onPositive = cross > 0;

  const aOuterEnd = onPositive ? aBase + 3 : aBase + 2;
  const bOuterStart = onPositive ? bBase + 1 : bBase + 0;

  // The corner of join `j` is the start of segment `j+1` (which is the END of
  // segment `j` — they share the same polyline point). For the wraparound join
  // on a closed polyline, j+1 wraps to segment 0 whose start is the closer
  // segment's endpoint, which is polyline point 0.
  const nextSeg = (j + 1) % segs.length;
  // The corner anchor is the start of the next segment (shared endpoint).
  // For a closed path's final join, nextSeg wraps to 0, whose start is
  // polyline point 0 — correct.
  const cornerSrc = segSrcIdx[nextSeg];
  const cornerA = plA[cornerSrc];
  const cornerB = plB[cornerSrc];
  const cornerT = plT[cornerSrc];
  // The two adjoining half-widths agree at the shared corner (a.halfB ===
  // b.halfA for a single-contour polyline), so use either for miter-limit
  // sizing. Force bevel when either adjacent segment itself tapers by
  // more than `varyingThreshold` — the miter apex math computes against
  // outer edges parallel to the segment direction, an assumption that
  // breaks on tapered trapezoids (outer edges fan in/out).
  const halfAtCorner = a.halfB;
  const taperA = Math.max(a.halfA, a.halfB) / Math.max(1e-9, Math.min(a.halfA, a.halfB));
  const taperB = Math.max(b.halfA, b.halfB) / Math.max(1e-9, Math.min(b.halfA, b.halfB));
  const forceBevelForVarying = taperA > varyingThreshold || taperB > varyingThreshold;

  if (join === 'bevel' || forceBevelForVarying) {
    emitBevel(a, aOuterEnd, bOuterStart, onPositive, verts, idx, anchorA, anchorB, anchorT, cornerA, cornerB, cornerT);
    return;
  }

  if (join === 'miter') {
    // Compute apex: intersection of A's outer edge extended forward and
    // B's outer edge extended backward. If miter length > MITER_LIMIT * half,
    // fall back to bevel.
    const aOX = verts[aOuterEnd * 2], aOY = verts[aOuterEnd * 2 + 1];
    const bOX = verts[bOuterStart * 2], bOY = verts[bOuterStart * 2 + 1];
    const apex = lineLineIntersect(aOX, aOY, adx, ady, bOX, bOY, -bdx, -bdy);
    if (!apex) {
      emitBevel(a, aOuterEnd, bOuterStart, onPositive, verts, idx, anchorA, anchorB, anchorT, cornerA, cornerB, cornerT);
      return;
    }
    const miterLen = Math.hypot(apex[0] - a.bx, apex[1] - a.by);
    if (miterLen > miterLimit * halfAtCorner) {
      emitBevel(a, aOuterEnd, bOuterStart, onPositive, verts, idx, anchorA, anchorB, anchorT, cornerA, cornerB, cornerT);
      return;
    }
    // A miter join's outer face is a kite quadrilateral with vertices
    // (R1, apex, R0, J) — covered by TWO triangles. The bevel inner half
    // (R1, R0, J) fills the area between the joint corner and the diagonal
    // hypotenuse R0-R1; the outer extension (R1, apex, R0) fills from the
    // hypotenuse to the apex point. Without the bevel half, an "inverted
    // triangle" gap opens at every miter corner.
    const apexIdx = verts.length / 2;
    verts.push(apex[0], apex[1]);
    anchorA.push(cornerA); anchorB.push(cornerB); anchorT.push(cornerT);
    const jIdx = verts.length / 2;
    verts.push(a.bx, a.by);
    anchorA.push(cornerA); anchorB.push(cornerB); anchorT.push(cornerT);
    if (onPositive) {
      idx.push(aOuterEnd, apexIdx, bOuterStart);
      idx.push(aOuterEnd, bOuterStart, jIdx);
    } else {
      idx.push(aOuterEnd, bOuterStart, apexIdx);
      idx.push(aOuterEnd, jIdx, bOuterStart);
    }
    return;
  }

  if (join === 'round') {
    emitRoundJoin(a, aOuterEnd, bOuterStart, onPositive, verts, idx, anchorA, anchorB, anchorT, cornerA, cornerB, cornerT);
    return;
  }
}

const ROUND_STEP_RAD = (10 * Math.PI) / 180;   // ~10° per fan triangle

function emitRoundJoin(
  a: Seg, aOuterEnd: number, bOuterStart: number, onPositive: boolean,
  verts: number[], idx: number[],
  anchorA: number[], anchorB: number[], anchorT: number[],
  cornerA: number, cornerB: number, cornerT: number,
): void {
  // Pivot = joint center; emit fresh vertex.
  const cx = a.bx, cy = a.by;
  const pivotIdx = verts.length / 2;
  verts.push(cx, cy);
  anchorA.push(cornerA); anchorB.push(cornerB); anchorT.push(cornerT);

  const startX = verts[aOuterEnd * 2] - cx;
  const startY = verts[aOuterEnd * 2 + 1] - cy;
  const endX = verts[bOuterStart * 2] - cx;
  const endY = verts[bOuterStart * 2 + 1] - cy;
  const r = Math.hypot(startX, startY);

  const startAngle = Math.atan2(startY, startX);
  const endAngle = Math.atan2(endY, endX);
  // Outer-side sweep: for CCW turns (cross > 0, onPositive true) outer is on
  // the -n side and the arc sweeps from R1 (south of joint) clockwise to R0
  // (east of joint) — i.e., negative sweep. For CW turns, sweep is positive.
  // Pick the SHORT arc that crosses the outer wedge. For onPositive=true
  // (CW turn in screen coords with y-down), the outer wedge sits where the
  // natural sweep is positive; for onPositive=false, where it is negative.
  // If the natural sweep has the wrong sign, wrap by ±2π.
  let sweep = endAngle - startAngle;
  if (onPositive && sweep < 0) sweep += 2 * Math.PI;
  else if (!onPositive && sweep > 0) sweep -= 2 * Math.PI;

  const steps = Math.max(1, Math.ceil(Math.abs(sweep) / ROUND_STEP_RAD));
  const stepAngle = sweep / steps;

  let prevIdx = aOuterEnd;
  for (let i = 1; i < steps; i++) {
    const ang = startAngle + i * stepAngle;
    const fx = cx + Math.cos(ang) * r;
    const fy = cy + Math.sin(ang) * r;
    const newIdx = verts.length / 2;
    verts.push(fx, fy);
    anchorA.push(cornerA); anchorB.push(cornerB); anchorT.push(cornerT);
    if (onPositive) idx.push(prevIdx, pivotIdx, newIdx);
    else            idx.push(prevIdx, newIdx, pivotIdx);
    prevIdx = newIdx;
  }
  if (onPositive) idx.push(prevIdx, pivotIdx, bOuterStart);
  else            idx.push(prevIdx, bOuterStart, pivotIdx);
}

function emitBevel(
  a: Seg, aOuterEnd: number, bOuterStart: number, onPositive: boolean,
  verts: number[], idx: number[],
  anchorA: number[], anchorB: number[], anchorT: number[],
  cornerA: number, cornerB: number, cornerT: number,
): void {
  const jIdx = verts.length / 2;
  verts.push(a.bx, a.by);
  anchorA.push(cornerA); anchorB.push(cornerB); anchorT.push(cornerT);
  if (onPositive) idx.push(aOuterEnd, jIdx, bOuterStart);
  else            idx.push(aOuterEnd, bOuterStart, jIdx);
}

/**
 * Solve for the intersection of line A (point ap, direction ad) with line B
 * (point bp, direction bd). Returns null if parallel or near-parallel.
 */
function lineLineIntersect(
  apx: number, apy: number, adx: number, ady: number,
  bpx: number, bpy: number, bdx: number, bdy: number,
): [number, number] | null {
  const denom = adx * bdy - ady * bdx;
  if (Math.abs(denom) < 1e-9) return null;
  const t = ((bpx - apx) * bdy - (bpy - apy) * bdx) / denom;
  return [apx + t * adx, apy + t * ady];
}
