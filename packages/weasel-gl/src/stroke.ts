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

  const polylines = extractPolylines(path, opts);
  const verts: number[] = [];
  const idx: number[] = [];

  for (const pl of polylines) {
    expandPolyline(pl, width, join, verts, idx);
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

  // round join: implemented in next task.
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
