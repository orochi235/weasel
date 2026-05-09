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

/**
 * Build a triangle-mesh ribbon from a stroked Path.
 *
 * Step-2 v1 scope:
 *   - cap: 'butt'  (no extension at endpoints)
 *   - join: 'bevel' (CPU triangle filling the wedge between segments)
 *   - center alignment (caller deflates/inflates rects upstream for inner/outer)
 *   - solid (no dash)
 *
 * Subsequent tasks add other caps, miter/round joins, dashes, and stencil-
 * based inner/outer alignment for arbitrary paths.
 */
export function tessellateStroke(
  path: Path,
  stroke: Stroke,
  opts: StrokeOptions = {},
): Mesh {
  const width = stroke.width ?? 1;
  if (width <= 0) return EMPTY_MESH;

  const polylines = extractPolylines(path, opts);
  const verts: number[] = [];
  const idx: number[] = [];

  for (const pl of polylines) {
    expandPolyline(pl, width, verts, idx);
  }

  return {
    vertices: new Float32Array(verts),
    indices: new Uint32Array(idx),
  };
}

function expandPolyline(pl: Polyline, width: number, verts: number[], idx: number[]): void {
  const half = width / 2;
  const pts = pl.points;
  const segCount = pts.length / 2 - 1;
  if (segCount < 1) return;

  for (let s = 0; s < segCount; s++) {
    emitRibbonQuad(pts[s * 2], pts[s * 2 + 1], pts[(s + 1) * 2], pts[(s + 1) * 2 + 1], half, verts, idx);
  }

  if (pl.closed) {
    const ax = pts[pts.length - 2], ay = pts[pts.length - 1];
    const bx = pts[0], by = pts[1];
    emitRibbonQuad(ax, ay, bx, by, half, verts, idx);
  }
}

function emitRibbonQuad(
  ax: number, ay: number,
  bx: number, by: number,
  half: number,
  verts: number[], idx: number[],
): void {
  const dx = bx - ax, dy = by - ay;
  const len = Math.hypot(dx, dy);
  if (len === 0) return;
  // Perpendicular (rotated 90° CCW), normalized × half-width.
  const nx = (-dy / len) * half;
  const ny = (dx / len) * half;

  const base = verts.length / 2;
  verts.push(ax + nx, ay + ny);   // L0
  verts.push(ax - nx, ay - ny);   // R0
  verts.push(bx + nx, by + ny);   // L1
  verts.push(bx - nx, by - ny);   // R1
  idx.push(base, base + 1, base + 2, base + 1, base + 3, base + 2);
}
