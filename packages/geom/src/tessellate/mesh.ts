/**
 * A tessellated representation of a Path, ready to upload to GL.
 *
 * - `vertices` is interleaved x,y in path-local coordinates.
 * - `indices` are triangle indices into `vertices`.
 * - `requiresStencil` is set for paths whose fillRule is `'evenodd'`, whose
 *   triangulation is a *naive* per-contour fan rather than a clean
 *   inside/outside triangulation. The renderer must use a stencil
 *   two-pass when this flag is true.
 * - `anchorA` / `anchorB` / `anchorT` parameterize each mesh vertex by
 *   the two consecutive path anchors it lies between and the arc-length
 *   fraction along that segment (0 = at A, 1 = at B). Vertices that fall
 *   exactly on an anchor set A === B and t = 0. Used at draw time when
 *   the DrawCommand supplies per-anchor colors. Optional — emitted by the
 *   path tessellators.
 */
export interface Mesh {
  readonly vertices: Float32Array;
  readonly indices: Uint32Array;
  readonly requiresStencil?: boolean;
  readonly anchorA?: Uint32Array;
  readonly anchorB?: Uint32Array;
  readonly anchorT?: Float32Array;
  /** The point `vertices` are measured from, as `PolygonPath.origin`, which
   *  a mesh built from such a path carries. Absent is `(0, 0)`. */
  readonly origin?: { readonly x: number; readonly y: number };
}
