/**
 * Glyph outlines as world-space meshes: each glyph's em-space fill or stroke
 * mesh, placed and concatenated so a run of outlined text is one draw.
 */
import type { Mesh } from '@weasel-js/geom/tessellate';
import type { LaidOutGroup, LaidOutOutlineGlyph } from '@weasel-js/text';
import { strokeSpaceOf } from 'features/paths/tessellate/metric';
import type { GlMat3 } from './math/mat3';
import { quantizeStrokeScale } from './cache/strokeMeshCache';
import { outlineMesh } from './cache/outlineMeshCache';
import { outlineStrokeMesh, quantizeEmWidth } from './cache/outlineStrokeMeshCache';
import { SYNTHETIC_ITALIC_RADIANS } from './syntheticItalic';

/**
 * Merge a group's glyphs into one world-space mesh, or `null` when nothing in
 * it has area.
 *
 * Every glyph mesh here is `'nonzero'` (that is what `pathFromD` produces and
 * what a font outline means), so none of them sets `requiresStencil` and
 * concatenating their triangles is sound — an even-odd mesh would be a naive
 * per-contour fan that only resolves correctly through a stencil pass, and
 * merging one into a batch would fill its counters solid.
 */
export function outlineGroupMesh(group: LaidOutGroup, dx: number, dy: number): Mesh | null {
  return mergeGlyphMeshes(group, dx, dy, (glyph) => outlineMesh(glyph.key, glyph.d));
}

/**
 * The same merge for the group's stroke: one ribbon per glyph, tessellated in
 * em space and batched into one buffer, so a stroked paragraph is one extra
 * draw call rather than one per glyph.
 *
 * A world width crosses into em space by dividing by the glyph's `scale`,
 * which is world units per em — so `stroke.width` stays a world-unit measure
 * and does not grow with `fontSize`, matching every other stroke in the kit.
 * Dashes cross with it.
 *
 * A synthetic oblique shears a world-width ribbon along with the glyph. That
 * is a real (small) distortion — a sheared circle is an ellipse, so the
 * outline is marginally thicker across the lean than along it — and it is
 * deliberate: shearing the finished ribbon is what keeps the outline glued to
 * the glyph it outlines, which re-tessellating in sheared space would not.
 *
 * A `{ px }` ribbon is built in the stretch of the whole em-to-screen map,
 * shear included, as a path's is in its transform's (see `metric.ts`), so it
 * is that many pixels wide in every direction on every glyph.
 */
export function outlineGroupStrokeMesh(
  group: LaidOutGroup,
  dx: number,
  dy: number,
  transform: GlMat3,
): Mesh | null {
  const stroke = group.stroke;
  if (!stroke) return null;
  const width = stroke.width ?? 1;
  if (typeof width === 'object') {
    if (!(width.px > 0)) return null;
    const shear = shearOf(group);
    const [a, b, c, d] = [transform[0], transform[1], transform[3], transform[4]];
    return mergeGlyphMeshes(group, dx, dy, (glyph) => {
      if (!(glyph.scale > 0)) return null;
      const s = glyph.scale;
      const space = strokeSpaceOf(s * a, s * b, s * (c - a * shear), s * (d - b * shear));
      const pxPerEm = quantizeStrokeScale(width.px, space.scale);
      if (!(pxPerEm > 0)) return null;
      const dash = stroke.dash?.map((v) => v / pxPerEm);
      return outlineStrokeMesh(
        glyph.key, glyph.d, width.px / pxPerEm, { ...stroke, dash }, space.metric ?? undefined,
      );
    });
  }
  if (!(width > 0)) return null;
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
 * Transform each glyph's em-space mesh into world space and concatenate.
 * Shared by the fill and stroke paths, which differ only in which mesh they
 * ask for per glyph — the placement math must not fork, or an outline would
 * drift off the glyph it outlines.
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
  // `-ey * scale`, so above-baseline vertices (negative ey) lean right.
  const shear = shearOf(group);

  const vertices = new Float32Array(vertexFloats);
  const indices = new Uint32Array(indexCount);
  let vi = 0;
  let ii = 0;
  let base = 0;
  for (const { mesh, glyph } of parts) {
    const { x, baselineY, scale } = glyph;
    for (let k = 0; k < mesh.vertices.length; k += 2) {
      const ex = mesh.vertices[k];
      const ey = mesh.vertices[k + 1];
      vertices[vi++] = x + dx + (ex - ey * shear) * scale;
      vertices[vi++] = baselineY + dy + ey * scale;
    }
    for (let k = 0; k < mesh.indices.length; k++) indices[ii++] = base + mesh.indices[k];
    base += mesh.vertices.length / 2;
  }
  return { vertices, indices };
}
