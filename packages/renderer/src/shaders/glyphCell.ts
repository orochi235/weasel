/**
 * Which corner of its quad a grown glyph vertex is, carried in `a_post` beside
 * the synthetic-bold shift: the shift plus twice the corner's index, so the
 * vertex is no wider. Only a quad grown for area coverage carries corners
 * (`GLYPH_AREA_MARGIN`); the fragment reads them back as the `cell` that
 * `glyphCoverage` takes.
 *
 * The shift is under 1, so the corner is the whole part of half the value.
 */

/** What each corner adds to `a_post`, in `pushGlyph`'s order: top left, top
 *  right, bottom right, bottom left. Corner `i` is `x + 2 * y` at `(x, y)`. */
export const GLYPH_CORNER_POST: readonly number[] = [0, 2, 6, 4];

/** `vec3 glyphCellOf(float post)`: a glyph vertex's `a_post` as its cell
 *  corner (`.xy`) and its synthetic-bold shift (`.z`). */
export const GLYPH_CELL_VERT_GLSL = /* glsl */ `
vec3 glyphCellOf(float post) {
  float corner = floor(post * 0.5);
  return vec3(mod(corner, 2.0), floor(corner * 0.5), post - 2.0 * corner);
}
`;
