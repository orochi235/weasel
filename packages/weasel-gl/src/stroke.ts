import type { Path, Stroke } from '@orochi235/weasel';
import type { Mesh } from './mesh';
import { extractPolylines, type Polyline } from './polyline';

export interface StrokeOptions {
  flattenTolerance?: number;
}

const EMPTY_MESH: Mesh = {
  vertices: new Float32Array(0),
  indices: new Uint32Array(0),
};

type Cap = 'butt' | 'round' | 'square';
type Join = 'miter' | 'round' | 'bevel';

/** Per-segment data the join code needs. */
interface Seg {
  ax: number; ay: number;
  bx: number; by: number;
  /** Perpendicular × half-width (rotated 90° CCW from direction). */
  nx: number; ny: number;
  len: number;
}

/**
 * Build a triangle-mesh ribbon from a stroked Path.
 *
 * Step-2 v1 scope:
 *   - cap: 'butt' (others added in Task 7)
 *   - join: 'bevel' (miter + round added in Tasks 5-6)
 *   - center alignment (RectPath alignment in Task 10; PolygonPath inner/
 *     outer via stencil in Task 11)
 *   - solid (no dash; dash splitting in Task 8)
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

  const polylines = extractPolylines(path, opts);
  const dash = stroke.dash ?? [];
  const verts: number[] = [];
  const idx: number[] = [];

  for (const pl of polylines) {
    const subs = dash.length > 0 ? splitForDash(pl, dash) : [pl];
    for (const sub of subs) {
      expandPolyline(sub, width, join, cap, verts, idx);
    }
  }

  return {
    vertices: new Float32Array(verts),
    indices: new Uint32Array(idx),
  };
}

function expandPolyline(
  pl: Polyline,
  width: number,
  join: Join,
  cap: Cap,
  verts: number[],
  idx: number[],
): void {
  const half = width / 2;
  const pts = pl.points;
  const segCount = pts.length / 2 - 1;
  if (segCount < 1) return;

  const segs: Seg[] = [];
  for (let s = 0; s < segCount; s++) {
    const seg = makeSeg(pts[s * 2], pts[s * 2 + 1], pts[(s + 1) * 2], pts[(s + 1) * 2 + 1], half);
    if (seg) segs.push(seg);
  }
  if (pl.closed && segs.length >= 1) {
    const last = segs[segs.length - 1];
    const first = segs[0];
    const closer = makeSeg(last.bx, last.by, first.ax, first.ay, half);
    if (closer) segs.push(closer);
  }
  if (segs.length === 0) return;

  // Emit one ribbon quad per segment. Record each segment's base vertex index.
  const segBaseIdx: number[] = [];
  for (const seg of segs) {
    const base = verts.length / 2;
    segBaseIdx.push(base);
    verts.push(seg.ax + seg.nx, seg.ay + seg.ny);  // 0: L0
    verts.push(seg.ax - seg.nx, seg.ay - seg.ny);  // 1: R0
    verts.push(seg.bx + seg.nx, seg.by + seg.ny);  // 2: L1
    verts.push(seg.bx - seg.nx, seg.by - seg.ny);  // 3: R1
    idx.push(base, base + 1, base + 2, base + 1, base + 3, base + 2);
  }

  // Joins between consecutive segments. For a closed polyline, the closing
  // segment is already in `segs`, so we have N segments and N joins.
  // For open, N segments and N-1 joins.
  const joinCount = pl.closed ? segs.length : segs.length - 1;
  for (let j = 0; j < joinCount; j++) {
    emitJoin(segs, segBaseIdx, j, half, join, verts, idx);
  }

  // Caps on open polylines only.
  if (!pl.closed && cap !== 'butt') {
    const first = segs[0];
    const firstBase = segBaseIdx[0];
    emitCap(first, firstBase + 0, firstBase + 1, /* atEnd */ false, half, cap, verts, idx);

    const last = segs[segs.length - 1];
    const lastBase = segBaseIdx[segs.length - 1];
    emitCap(last, lastBase + 2, lastBase + 3, /* atEnd */ true, half, cap, verts, idx);
  }
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
): void {
  // Outward direction = forward at end, backward at start.
  const sign = atEnd ? 1 : -1;
  const dx = (seg.bx - seg.ax) / seg.len * sign;
  const dy = (seg.by - seg.ay) / seg.len * sign;
  const cx = atEnd ? seg.bx : seg.ax;
  const cy = atEnd ? seg.by : seg.ay;

  if (cap === 'square') {
    const ox = cx + dx * half;
    const oy = cy + dy * half;
    const lOut = verts.length / 2;
    verts.push(ox + seg.nx, oy + seg.ny);
    const rOut = verts.length / 2;
    verts.push(ox - seg.nx, oy - seg.ny);
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

    // Starting angle: direction from pivot to L (= +n direction).
    const startAngle = Math.atan2(seg.ny, seg.nx);
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
 * The "off" portions become invisible gaps.
 */
function splitForDash(pl: Polyline, dash: number[]): Polyline[] {
  const out: Polyline[] = [];
  let dashIdx = 0;
  let dashRemaining = dash[0];
  let onPhase = true;
  let current: Polyline | null = onPhase ? { points: [pl.points[0], pl.points[1]], closed: false } : null;

  const advance = () => {
    if (current && current.points.length >= 4) out.push(current);
    current = null;
    dashIdx = (dashIdx + 1) % dash.length;
    dashRemaining = dash[dashIdx];
    onPhase = !onPhase;
  };

  let prevX = pl.points[0], prevY = pl.points[1];
  const segCount = pl.points.length / 2 - 1;
  for (let i = 0; i < segCount; i++) {
    const cx = pl.points[(i + 1) * 2], cy = pl.points[(i + 1) * 2 + 1];
    let segDx = cx - prevX, segDy = cy - prevY;
    let segLen = Math.hypot(segDx, segDy);

    while (segLen > 1e-9) {
      if (segLen <= dashRemaining) {
        if (onPhase && current) current.points.push(cx, cy);
        dashRemaining -= segLen;
        prevX = cx; prevY = cy;
        segLen = 0;
        if (dashRemaining <= 1e-9) {
          advance();
          if (onPhase) current = { points: [prevX, prevY], closed: false };
        }
      } else {
        const t = dashRemaining / segLen;
        const ix = prevX + segDx * t;
        const iy = prevY + segDy * t;
        if (onPhase && current) current.points.push(ix, iy);
        prevX = ix; prevY = iy;
        segDx = cx - prevX; segDy = cy - prevY;
        segLen = Math.hypot(segDx, segDy);
        advance();
        if (onPhase) current = { points: [prevX, prevY], closed: false };
      }
    }
  }

  if (current && current.points.length >= 4) out.push(current);
  return out;
}

function makeSeg(ax: number, ay: number, bx: number, by: number, half: number): Seg | null {
  const dx = bx - ax, dy = by - ay;
  const len = Math.hypot(dx, dy);
  if (len === 0) return null;
  return { ax, ay, bx, by, nx: (-dy / len) * half, ny: (dx / len) * half, len };
}

/** Canvas2D's default miter limit. `Stroke` doesn't currently have a `miterLimit` field; document deferred. */
const MITER_LIMIT = 10;

function emitJoin(
  segs: Seg[], segBaseIdx: number[], j: number, half: number, join: Join,
  verts: number[], idx: number[],
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

  if (join === 'bevel') {
    emitBevel(a, aOuterEnd, bOuterStart, onPositive, verts, idx);
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
      emitBevel(a, aOuterEnd, bOuterStart, onPositive, verts, idx);
      return;
    }
    const miterLen = Math.hypot(apex[0] - a.bx, apex[1] - a.by);
    if (miterLen > MITER_LIMIT * half) {
      emitBevel(a, aOuterEnd, bOuterStart, onPositive, verts, idx);
      return;
    }
    const apexIdx = verts.length / 2;
    verts.push(apex[0], apex[1]);
    if (onPositive) idx.push(aOuterEnd, apexIdx, bOuterStart);
    else            idx.push(aOuterEnd, bOuterStart, apexIdx);
    return;
  }

  if (join === 'round') {
    emitRoundJoin(a, aOuterEnd, bOuterStart, onPositive, verts, idx);
    return;
  }
}

const ROUND_STEP_RAD = (10 * Math.PI) / 180;   // ~10° per fan triangle

function emitRoundJoin(
  a: Seg, aOuterEnd: number, bOuterStart: number, onPositive: boolean,
  verts: number[], idx: number[],
): void {
  // Pivot = joint center; emit fresh vertex.
  const cx = a.bx, cy = a.by;
  const pivotIdx = verts.length / 2;
  verts.push(cx, cy);

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
  let sweep = endAngle - startAngle;
  if (onPositive && sweep > 0) sweep -= 2 * Math.PI;
  else if (!onPositive && sweep < 0) sweep += 2 * Math.PI;

  const steps = Math.max(1, Math.ceil(Math.abs(sweep) / ROUND_STEP_RAD));
  const stepAngle = sweep / steps;

  let prevIdx = aOuterEnd;
  for (let i = 1; i < steps; i++) {
    const ang = startAngle + i * stepAngle;
    const fx = cx + Math.cos(ang) * r;
    const fy = cy + Math.sin(ang) * r;
    const newIdx = verts.length / 2;
    verts.push(fx, fy);
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
): void {
  const jIdx = verts.length / 2;
  verts.push(a.bx, a.by);
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
