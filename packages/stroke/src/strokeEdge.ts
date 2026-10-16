/**
 * Where a stroke's outline edge runs near a point: what an editor that drags a
 * stroke's edge hit-tests and measures against.
 */
import type { Path } from '@weasel-js/geom';
import { extractPolylines } from '@weasel-js/geom/tessellate';
import type { Stroke } from '@weasel-js/paint';
import { strokeFlattening } from './tessellate/flattening';
import { nibWidthScale } from './tessellate/nib';
import { resolveStrokeWidth } from './tessellate/stroke';
import { populateWidths } from './tessellate/vertexWidths';

/** One side of a stroke's ribbon, as `VertexWidth` names them. */
export type StrokeSide = 'left' | 'right';

/** A stroke's edge nearest a point, as {@link strokeEdgeNear} finds it. */
export interface StrokeEdgeHit {
  /** The point on the path's flattening the edge is measured from. */
  x: number;
  y: number;
  /** The unit normal there, pointing from the path toward the edge. */
  nx: number;
  ny: number;
  /** Which edge this is. */
  side: StrokeSide;
  /** How far each edge sits from the path there, as drawn: per-vertex widths
   *  and the nib applied. */
  left: number;
  right: number;
  /** How far the query point lies outside the edge; negative inside the ink. */
  gap: number;
  /** What the nib multiplies the width by there, `1` without one. */
  factor: number;
}

/** Options for {@link strokeEdgeNear}. */
export interface StrokeEdgeOptions {
  /** Screen pixels per world unit, for a `{ px }` width. Default 1. */
  scale?: number;
  flattenTolerance?: number;
}

/**
 * The edge of `stroke`, drawn along `path`, that passes nearest `(x, y)`,
 * measured along the path's normal: either side of a centered stroke, with
 * per-vertex widths (each side of a pair on its own) and the nib applied.
 * Alignment, caps, joins, and markers are not considered. `null` when the path
 * has no segment of any length.
 */
export function strokeEdgeNear(
  path: Path, stroke: Stroke, x: number, y: number, opts: StrokeEdgeOptions = {},
): StrokeEdgeHit | null {
  const width = resolveStrokeWidth(stroke.width ?? 1, opts.scale ?? 1);
  const vw = stroke.vertexWidths && stroke.vertexWidths.length > 0 ? stroke.vertexWidths : null;
  const nibScale = stroke.nib ? nibWidthScale(stroke.nib) : null;
  let best: StrokeEdgeHit | null = null;
  for (const pl of extractPolylines(path, strokeFlattening(opts.flattenTolerance, width, vw ?? undefined))) {
    populateWidths(pl, vw, stroke.nib, width);
    const P = pl.points, W = pl.widths, O = pl.offsets;
    const n = P.length / 2;
    const segCount = pl.closed ? n : n - 1;
    for (let i = 0; i < segCount; i++) {
      const j = (i + 1) % n;
      const ax = P[i * 2], ay = P[i * 2 + 1];
      const dx = P[j * 2] - ax, dy = P[j * 2 + 1] - ay;
      const len2 = dx * dx + dy * dy;
      if (len2 === 0) continue;
      const len = Math.sqrt(len2);
      const f = Math.min(1, Math.max(0, ((x - ax) * dx + (y - ay) * dy) / len2));
      const fx = ax + dx * f, fy = ay + dy * f;
      const rx = -dy / len, ry = dx / len;
      const d = (x - fx) * rx + (y - fy) * ry;
      const w = W ? W[i] + (W[j] - W[i]) * f : width;
      const o = O ? O[i] + (O[j] - O[i]) * f : 0;
      const side: StrokeSide = d >= 0 ? 'right' : 'left';
      const left = w / 2 - o, right = w / 2 + o;
      // Past a segment's end the point is off its normal, so the gap is the
      // straight distance, not the distance across the line.
      const gap = Math.hypot(x - fx, y - fy) - (side === 'right' ? right : left);
      if (best !== null && Math.abs(gap) >= Math.abs(best.gap)) continue;
      const sign = side === 'right' ? 1 : -1;
      best = {
        x: fx, y: fy, nx: rx * sign, ny: ry * sign, side, left, right, gap,
        factor: nibScale ? nibScale(dx / len, dy / len) : 1,
      };
    }
  }
  return best;
}
