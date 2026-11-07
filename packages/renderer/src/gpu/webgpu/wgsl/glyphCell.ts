/** `GLYPH_CELL_VERT_GLSL` in WGSL: a glyph vertex's `a_post` as its cell
 *  corner (`.xy`) and its synthetic-bold shift (`.z`). */
export const GLYPH_CELL_WGSL = /* wgsl */ `
fn glyphCellOf(post: f32) -> vec3f {
  let corner = floor(post * 0.5);
  let row = floor(corner * 0.5);
  return vec3f(corner - 2.0 * row, row, post - 2.0 * corner);
}
`;
