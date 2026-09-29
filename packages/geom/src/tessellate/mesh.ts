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
 * - `anchorA` / `anchorB` / `anchorT` parameterize each mesh vertex by
 *   the two consecutive path anchors it lies between and the arc-length
 *   fraction along that segment (0 = at A, 1 = at B). Vertices that fall
 *   exactly on an anchor set A === B and t = 0. Used at draw time when
 *   the DrawCommand supplies per-anchor colors so the renderer can lerp
 *   per mesh vertex. Optional — emitted by the path tessellators; absent
 *   on meshes built by other paths (e.g. text glyphs).
 */
export interface Mesh {
  readonly vertices: Float32Array;
  readonly indices: Uint32Array;
  readonly requiresStencil?: boolean;
  readonly anchorA?: Uint32Array;
  readonly anchorB?: Uint32Array;
  readonly anchorT?: Float32Array;
}
