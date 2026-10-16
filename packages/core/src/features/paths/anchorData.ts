/**
 * What a node keeps per anchor or per point of its path beside the geometry,
 * carried through an anchor edit: a skin's weights, the fill's and the
 * stroke's vertex colors, and the stroke's widths. The edit says where each
 * new point came from (`editAnchorSetTracked`); everything here follows it.
 */
import {
  anchorOriginsOf, remapAnchorValues, type PointOrigin, type PolygonPath,
} from '@weasel-js/geom';
import { vertexHalfWidths, vertexWidthFromSides, type VertexWidth } from '@weasel-js/paint';
import type { Skin } from '@weasel-js/animator';
import { remapSkin } from '../../animation/rig/skinBinding';

/** Channels per anchor in a `vertexColors` array. */
const COLOR_STRIDE = 4;

interface AnchorDataCarrier {
  skin?: Skin;
  vertexColors?: number[];
  stroke?: { vertexColors?: number[]; vertexWidths?: VertexWidth[]; width?: unknown } | null;
}

type Edit = { before: PolygonPath; after: PolygonPath; origins: readonly (PointOrigin | null)[] };

const swapped = (w: VertexWidth): VertexWidth => (typeof w === 'number' ? w : { left: w.right, right: w.left });

/**
 * A stroke's `vertexWidths` through an edit. A kept anchor keeps its entry,
 * its sides traded where its subpath now runs the other way; a made one
 * blends the sides of the two it came between, an unset side reading the
 * stroke's own `width`; a deleted one's entry goes. Unset stays `NaN`.
 */
function carryWidths(widths: readonly VertexWidth[], width: unknown, { before, after, origins }: Edit): VertexWidth[] {
  const fallback = typeof width === 'number' ? width : Number.NaN;
  return anchorOriginsOf(before, after, origins).map((o) => {
    if (!o) return Number.NaN;
    let entry: VertexWidth = widths[o.a] ?? Number.NaN;
    if (o.t !== 0 && o.b !== o.a) {
      const a = vertexHalfWidths(widths[o.a], fallback);
      const b = vertexHalfWidths(widths[o.b], fallback);
      entry = vertexWidthFromSides(a.left + (b.left - a.left) * o.t, a.right + (b.right - a.right) * o.t);
    }
    return o.reversed ? swapped(entry) : entry;
  });
}

/**
 * The per-anchor fields of `data`, renumbered for the edit from `before` to
 * `after`, to lay over it; empty when it holds none. Only what `data`
 * already has is written.
 */
export function anchorDataPatch(
  data: unknown,
  before: PolygonPath,
  after: PolygonPath,
  origins: readonly (PointOrigin | null)[],
): Record<string, unknown> {
  if (!data || typeof data !== 'object') return {};
  const d = data as AnchorDataCarrier;
  const edit = { before, after, origins };
  const colors = (values: number[]) => remapAnchorValues(values, COLOR_STRIDE, before, after, origins);
  const patch: AnchorDataCarrier = {};
  if (d.skin) patch.skin = remapSkin(d.skin, origins);
  if (d.vertexColors) patch.vertexColors = colors(d.vertexColors);
  const stroke = d.stroke;
  if (stroke?.vertexColors || stroke?.vertexWidths) {
    patch.stroke = {
      ...stroke,
      ...(stroke.vertexColors ? { vertexColors: colors(stroke.vertexColors) } : {}),
      ...(stroke.vertexWidths ? { vertexWidths: carryWidths(stroke.vertexWidths, stroke.width, edit) } : {}),
    };
  }
  return patch as Record<string, unknown>;
}
