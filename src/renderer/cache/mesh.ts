/**
 * A tessellated representation of a Path, ready to upload to GL.
 *
 * - `vertices` is interleaved x,y in path-local coordinates (`Float32Array`
 *   of length `2 * vertexCount`).
 * - `indices` are triangle indices into `vertices` (`Uint32Array`, length
 *   `3 * triangleCount`).
 * - `requiresStencil` is set for paths whose fillRule is `'evenodd'` and
 *   whose triangulation is a *naive* per-contour fan rather than a clean
 *   inside/outside triangulation. The renderer must use a stencil
 *   two-pass when this flag is true. Single-contour paths and `'nonzero'`
 *   multi-contour paths leave it false.
 */
export interface Mesh {
  readonly vertices: Float32Array;
  readonly indices: Uint32Array;
  readonly requiresStencil?: boolean;
}
