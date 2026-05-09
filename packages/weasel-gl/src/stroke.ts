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

function emitJoin(
  segs: Seg[], segBaseIdx: number[], j: number, _half: number, join: Join,
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

  // Outer-side vertex indices at the joint:
  // when cross > 0 (CCW turn), outer is on the -n side (R1, R0).
  // when cross < 0 (CW turn), outer is on the +n side (L1, L0).
  const aOuterEnd = onPositive ? aBase + 3 : aBase + 2;
  const bOuterStart = onPositive ? bBase + 1 : bBase + 0;

  if (join === 'bevel') {
    // Add the joint center as a fresh vertex; emit one triangle.
    const jIdx = verts.length / 2;
    verts.push(a.bx, a.by);
    if (onPositive) idx.push(aOuterEnd, jIdx, bOuterStart);
    else            idx.push(aOuterEnd, bOuterStart, jIdx);     // CCW orientation
    return;
  }
  // miter / round join branches added in following tasks.
}
