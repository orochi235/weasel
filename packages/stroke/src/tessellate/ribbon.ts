/**
 * The pieces of a stroke ribbon: one straight segment with each edge its own
 * distance from the path at either end, and the caps and joins drawn from
 * those edges.
 */

export type Cap = 'butt' | 'round' | 'square';
export type Join = 'miter' | 'round' | 'bevel';

/** Per-segment data the join code needs. */
export interface Seg {
  ax: number; ay: number;
  bx: number; by: number;
  /** Unit perpendicular (rotated 90° CCW from direction). */
  nxUnit: number; nyUnit: number;
  /** How far the edge on the +n side (`pos`) and the −n side (`neg`) sits
   *  from the path at the start (a) and end (b). All equal for a uniform
   *  stroke; they differ when the polyline carries per-point widths or
   *  offsets. */
  posA: number; negA: number;
  posB: number; negB: number;
  len: number;
}

const ROUND_CAP_STEP_RAD = (10 * Math.PI) / 180;

/**
 * Emit a cap at one end of a segment. `leftIdx`/`rightIdx` are the buffer
 * indices of the L (perpendicular +n) and R (perpendicular -n) vertices at
 * the segment endpoint where the cap attaches, `pos` and `neg` from the path.
 * `atEnd` chooses which end of the segment to extend from (and which
 * cap-direction sign to use). The cap is centered between the two edges.
 */
export function emitCap(
  seg: Seg, leftIdx: number, rightIdx: number, atEnd: boolean,
  pos: number, neg: number, cap: Cap,
  verts: number[], idx: number[],
  anchorA: number[], anchorB: number[], anchorT: number[],
  endA: number, endB: number, endT: number,
): void {
  // Outward direction = forward at end, backward at start.
  const sign = atEnd ? 1 : -1;
  const dx = (seg.bx - seg.ax) / seg.len * sign;
  const dy = (seg.by - seg.ay) / seg.len * sign;
  const half = (pos + neg) / 2;
  const shift = (pos - neg) / 2;
  const cx = (atEnd ? seg.bx : seg.ax) + seg.nxUnit * shift;
  const cy = (atEnd ? seg.by : seg.ay) + seg.nyUnit * shift;

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

export function makeSeg(
  ax: number, ay: number, bx: number, by: number,
  posA: number, negA: number, posB: number, negB: number,
): Seg | null {
  const dx = bx - ax, dy = by - ay;
  const len = Math.hypot(dx, dy);
  if (len === 0) return null;
  return {
    ax, ay, bx, by,
    nxUnit: -dy / len, nyUnit: dx / len,
    posA, negA, posB, negB,
    len,
  };
}

export function emitJoin(
  segs: Seg[], segBaseIdx: number[], j: number, join: Join,
  miterLimit: number,
  varyingThreshold: number,
  verts: number[], idx: number[],
  anchorA: number[], anchorB: number[], anchorT: number[],
  segSrcIdx: number[],
  plA: Uint32Array, plB: Uint32Array, plT: Float32Array,
  inner = -1,
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
  // The join is drawn on the outer edge: the −n side when turning toward +n.
  // Both segments agree on it at the shared corner, so either sizes the
  // miter limit. Force bevel when that edge tapers along either adjacent
  // segment by more than `varyingThreshold` — the miter apex math computes
  // against outer edges parallel to the segment direction, an assumption
  // that breaks on tapered trapezoids (outer edges fan in/out).
  const outerA = onPositive ? [a.negA, a.negB] : [a.posA, a.posB];
  const outerB = onPositive ? [b.negA, b.negB] : [b.posA, b.posB];
  const halfAtCorner = outerA[1];
  const taperA = Math.max(...outerA) / Math.max(1e-9, Math.min(...outerA));
  const taperB = Math.max(...outerB) / Math.max(1e-9, Math.min(...outerB));
  const forceBevelForVarying = taperA > varyingThreshold || taperB > varyingThreshold;

  if (join === 'bevel' || forceBevelForVarying) {
    emitBevel(a, aOuterEnd, bOuterStart, onPositive, verts, idx, anchorA, anchorB, anchorT, cornerA, cornerB, cornerT, inner);
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
      emitBevel(a, aOuterEnd, bOuterStart, onPositive, verts, idx, anchorA, anchorB, anchorT, cornerA, cornerB, cornerT, inner);
      return;
    }
    const miterLen = Math.hypot(apex[0] - a.bx, apex[1] - a.by);
    if (miterLen > miterLimit * halfAtCorner) {
      emitBevel(a, aOuterEnd, bOuterStart, onPositive, verts, idx, anchorA, anchorB, anchorT, cornerA, cornerB, cornerT, inner);
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
    const jIdx = inner >= 0 ? inner : cornerVertex(a, verts, anchorA, anchorB, anchorT, cornerA, cornerB, cornerT);
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
    emitRoundJoin(a, aOuterEnd, bOuterStart, onPositive, verts, idx, anchorA, anchorB, anchorT, cornerA, cornerB, cornerT, inner);
    return;
  }
}

const ROUND_STEP_RAD = (10 * Math.PI) / 180;   // ~10° per fan triangle

function emitRoundJoin(
  a: Seg, aOuterEnd: number, bOuterStart: number, onPositive: boolean,
  verts: number[], idx: number[],
  anchorA: number[], anchorB: number[], anchorT: number[],
  cornerA: number, cornerB: number, cornerT: number,
  inner: number,
): void {
  // The arc is about the joint; the fan is drawn from the inner corner the
  // segments meet at, where they meet there, else from the joint itself.
  const cx = a.bx, cy = a.by;
  const pivotIdx = inner >= 0 ? inner : cornerVertex(a, verts, anchorA, anchorB, anchorT, cornerA, cornerB, cornerT);

  const startX = verts[aOuterEnd * 2] - cx;
  const startY = verts[aOuterEnd * 2 + 1] - cy;
  const endX = verts[bOuterStart * 2] - cx;
  const endY = verts[bOuterStart * 2 + 1] - cy;
  const r0 = Math.hypot(startX, startY), r1 = Math.hypot(endX, endY);

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
    // Each side of a join can have its own width; the arc runs between them.
    const r = r0 + ((r1 - r0) * i) / steps;
    verts.push(cx + Math.cos(ang) * r, cy + Math.sin(ang) * r);
    const newIdx = verts.length / 2 - 1;
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
  inner: number,
): void {
  const jIdx = inner >= 0 ? inner : cornerVertex(a, verts, anchorA, anchorB, anchorT, cornerA, cornerB, cornerT);
  if (onPositive) idx.push(aOuterEnd, jIdx, bOuterStart);
  else            idx.push(aOuterEnd, bOuterStart, jIdx);
}

/** A fresh vertex at the joint, `a`'s end. */
function cornerVertex(
  a: Seg, verts: number[], anchorA: number[], anchorB: number[], anchorT: number[],
  cornerA: number, cornerB: number, cornerT: number,
): number {
  const at = verts.length / 2;
  verts.push(a.bx, a.by);
  anchorA.push(cornerA); anchorB.push(cornerB); anchorT.push(cornerT);
  return at;
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
