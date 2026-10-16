/**
 * One anchor's entry in `Stroke.vertexWidths`, and the one function every
 * reader resolves it through.
 */

/**
 * The stroke's width at one anchor: a number is the full width, centered on
 * the path; a pair is the distance from the path to each edge on its own.
 * `right` is the side the normal `(−dy, dx)` of the path's direction points
 * to, the right-hand side walking the path on a y-down screen: a path running
 * in +x has its right edge below it. Writers keep a pair only while its sides
 * differ (see {@link vertexWidthFromSides}).
 */
export type VertexWidth = number | VertexWidthSides;

/** A {@link VertexWidth} whose edges sit at different distances from the path. */
export interface VertexWidthSides {
  readonly left: number;
  readonly right: number;
}

/** How far each edge of a stroke sits from its path at one point. */
export interface HalfWidths {
  left: number;
  right: number;
}

const usable = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v) && v >= 0;

/**
 * The distance from the path to each edge for one `vertexWidths` entry. A
 * missing, non-finite, or negative value — a whole entry, or one side of a
 * pair — takes half of `fallback`, the stroke's own width; zero is a real zero.
 */
export function vertexHalfWidths(entry: VertexWidth | null | undefined, fallback: number): HalfWidths {
  const half = fallback / 2;
  if (typeof entry === 'number') return usable(entry) ? { left: entry / 2, right: entry / 2 } : { left: half, right: half };
  if (entry == null || typeof entry !== 'object') return { left: half, right: half };
  return { left: usable(entry.left) ? entry.left : half, right: usable(entry.right) ? entry.right : half };
}

/** The entry for edges `left` and `right` from the path: a number when they
 *  are equal, a pair otherwise. */
export function vertexWidthFromSides(left: number, right: number): VertexWidth {
  return Math.abs(left - right) <= 1e-9 * Math.max(1, Math.abs(left), Math.abs(right)) ? left + right : { left, right };
}

/** `entry` with every length in it multiplied by `k`; an unset one stays unset. */
export function scaleVertexWidth(entry: VertexWidth, k: number): VertexWidth {
  return typeof entry === 'number' ? entry * k : { left: entry.left * k, right: entry.right * k };
}

/** The farthest any edge of a stroke of `width` sits from its path. A nib
 *  only ever narrows a stroke, so this bounds one with a nib too. */
export function widestHalfWidth(width: number, vertexWidths: readonly VertexWidth[] | undefined): number {
  let widest = width / 2;
  if (vertexWidths) {
    for (const entry of vertexWidths) {
      const { left, right } = vertexHalfWidths(entry, width);
      widest = Math.max(widest, left, right);
    }
  }
  return widest;
}
