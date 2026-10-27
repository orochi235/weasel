/**
 * Glyph outlines as world-space meshes: each glyph's em-space fill or stroke
 * mesh, placed and concatenated so a run of outlined text is one draw.
 */
import type { Mesh } from '@weasel-js/geom/tessellate';
import type { LaidOutGroup, LaidOutOutlineGlyph } from '@weasel-js/text';
import { strokeHasInk } from '@weasel-js/paint';
import { strokeSpaceOf } from '@weasel-js/stroke';
import type { GlMat3 } from '@weasel-js/geom';
import { quantizeStrokeScale } from './cache/strokeMeshCache';
import { outlineMesh } from './cache/outlineMeshCache';
import { outlineStrokeMesh, quantizeEmWidth } from './cache/outlineStrokeMeshCache';
import { SYNTHETIC_ITALIC_RADIANS, glyphTurn } from '@weasel-js/text';

/**
 * Merge a group's glyphs into one world-space mesh, or `null` when nothing in
 * it has area.
 *
 * Every glyph mesh here is `'nonzero'`, so concatenating their triangles is
 * sound — an even-odd mesh only resolves correctly through a stencil pass, and
 * merging one into a batch would fill its counters solid.
 */
export function outlineGroupMesh(group: LaidOutGroup, dx: number, dy: number): Mesh | null {
  return mergeGlyphMeshes(group, dx, dy, (glyph) => outlineMesh(glyph.key, glyph.d));
}

/**
 * The same merge for the group's stroke: one ribbon per glyph, tessellated in
 * em space.
 *
 * `stroke.width` is a world-unit measure and does not grow with `fontSize`;
 * dashes likewise. A synthetic oblique shears a world-width ribbon along with
 * the glyph, so the outline is marginally thicker across the lean than along
 * it — deliberate, because it keeps the outline glued to the glyph.
 *
 * A `{ px }` ribbon is built in the stretch of the whole em-to-screen map,
 * shear included, so it is that many pixels wide in every direction.
 */
export function outlineGroupStrokeMesh(
  group: LaidOutGroup,
  dx: number,
  dy: number,
  transform: GlMat3,
): Mesh | null {
  const stroke = group.stroke;
  if (!strokeHasInk(stroke)) return null;
  const width = stroke.width ?? 1;
  if (typeof width === 'object') {
    const shear = shearOf(group);
    const [a, b, c, d] = [transform[0], transform[1], transform[3], transform[4]];
    return mergeGlyphMeshes(group, dx, dy, (glyph) => {
      if (!(glyph.scale > 0)) return null;
      const s = glyph.scale;
      // The em-to-screen map: shear, the glyph's turn, then `transform`.
      const [cos, sin] = glyphTurn(glyph.rotate);
      const ex = [cos * s, sin * s], ey = [-(cos * shear + sin) * s, (cos - sin * shear) * s];
      const space = strokeSpaceOf(
        a * ex[0] + c * ex[1], b * ex[0] + d * ex[1], a * ey[0] + c * ey[1], b * ey[0] + d * ey[1],
      );
      const pxPerEm = quantizeStrokeScale(width.px, space.scale);
      if (!(pxPerEm > 0)) return null;
      const dash = stroke.dash?.map((v) => v / pxPerEm);
      return outlineStrokeMesh(
        glyph.key, glyph.d, width.px / pxPerEm, { ...stroke, dash }, space.metric ?? undefined,
      );
    });
  }
  return mergeGlyphMeshes(group, dx, dy, (glyph) =>
    glyph.scale > 0
      ? outlineStrokeMesh(
        glyph.key, glyph.d, quantizeEmWidth(width / glyph.scale),
        { ...stroke, dash: stroke.dash?.map((v) => v / glyph.scale) },
      )
      : null);
}

const shearOf = (group: LaidOutGroup): number =>
  group.synthetic.italic ? Math.tan(SYNTHETIC_ITALIC_RADIANS) : 0;

/**
 * Transform each glyph's em-space mesh into world space and concatenate. The
 * fill and stroke paths share the placement math: it must not fork, or an
 * outline would drift off the glyph it outlines.
 */
function mergeGlyphMeshes(
  group: LaidOutGroup,
  dx: number,
  dy: number,
  meshFor: (glyph: LaidOutOutlineGlyph) => Mesh | null,
): Mesh | null {
  const parts: { mesh: Mesh; glyph: LaidOutOutlineGlyph }[] = [];
  let vertexFloats = 0;
  let indexCount = 0;
  for (const glyph of group.glyphs) {
    const mesh = meshFor(glyph);
    if (!mesh || mesh.indices.length === 0) continue;
    parts.push({ mesh, glyph });
    vertexFloats += mesh.vertices.length;
    indexCount += mesh.indices.length;
  }
  if (parts.length === 0) return null;

  // Matches the SDF vertex shader's skew exactly: x moves by
  // `(baselineY - y) * tan(angle)`, and in em space `baselineY - y` is
  // `-ey * scale`, so above-baseline vertices (negative ey) lean right. The
  // glyph's turn then rotates the sheared glyph about its pen.
  const shear = shearOf(group);

  const vertices = new Float32Array(vertexFloats);
  const indices = new Uint32Array(indexCount);
  let vi = 0;
  let ii = 0;
  let base = 0;
  for (const { mesh, glyph } of parts) {
    const { x, baselineY, scale } = glyph;
    const [cos, sin] = glyphTurn(glyph.rotate);
    for (let k = 0; k < mesh.vertices.length; k += 2) {
      const ex = mesh.vertices[k];
      const ey = mesh.vertices[k + 1];
      const lx = (ex - ey * shear) * scale, ly = ey * scale;
      vertices[vi++] = x + dx + lx * cos - ly * sin;
      vertices[vi++] = baselineY + dy + lx * sin + ly * cos;
    }
    for (let k = 0; k < mesh.indices.length; k++) indices[ii++] = base + mesh.indices[k];
    base += mesh.vertices.length / 2;
  }
  return { vertices, indices };
}
