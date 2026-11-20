/**
 * What a node keeps per anchor or per point of its path beside the geometry,
 * carried through an anchor edit: a skin's weights, the fill's and the
 * stroke's vertex colors, and the stroke's widths. The edit says where each
 * new point came from (`editAnchorSetTracked`); everything here follows it.
 */
import {
  anchorOriginsOf, remapAnchorValues, type PointOrigin, type PolygonPath,
  lerp,
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

const sideSet = (entry: VertexWidth | undefined, side: 'left' | 'right'): boolean => {
  const v = typeof entry === 'number' ? entry : entry?.[side];
  return typeof v === 'number' && Number.isFinite(v) && v >= 0;
};

/** The entry `t` of the way from `a` to `b`, an unset side reading `fallback`;
 *  a side neither sets stays unset, so it goes on following the stroke's width. */
function blendWidths(a: VertexWidth | undefined, b: VertexWidth | undefined, t: number, fallback: number): VertexWidth {
  const ha = vertexHalfWidths(a, fallback);
  const hb = vertexHalfWidths(b, fallback);
  const side = (s: 'left' | 'right') =>
    sideSet(a, s) || sideSet(b, s) ? lerp(ha[s], hb[s], t) : Number.NaN;
  const left = side('left');
  const right = side('right');
  if (Number.isNaN(left) && Number.isNaN(right)) return Number.NaN;
  if (Number.isNaN(left) || Number.isNaN(right)) return { left, right };
  return vertexWidthFromSides(left, right);
}

/**
 * A stroke's `vertexWidths` through an edit. A kept anchor keeps its entry,
 * its sides traded where its subpath now runs the other way; a made one
 * blends the two it came between ({@link blendWidths}); a deleted one's
 * entry goes. Unset stays `NaN`.
 */
function carryWidths(widths: readonly VertexWidth[], width: unknown, { before, after, origins }: Edit): VertexWidth[] {
  const fallback = typeof width === 'number' ? width : Number.NaN;
  return anchorOriginsOf(before, after, origins).map((o) => {
    if (!o) return Number.NaN;
    let entry: VertexWidth = widths[o.a] ?? Number.NaN;
    if (o.t !== 0 && o.b !== o.a) entry = blendWidths(widths[o.a], widths[o.b], o.t, fallback);
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

/**
 * `data` less each per-anchor array whose length does not match `anchors`, the anchor count of the path it
 * now holds: one carried over from a path with other anchors names points that are not there. `data` itself
 * when nothing is dropped. A skin is not checked here; it goes with the other geometry-bound data.
 */
export function withAnchorDataFitting<T>(data: T, anchors: number): T {
  if (!data || typeof data !== 'object') return data;
  const d = data as AnchorDataCarrier;
  const fits = (values: readonly unknown[] | undefined, stride: number) => !values || values.length === anchors * stride;
  const stroke = d.stroke;
  const strokeFits = !stroke || (fits(stroke.vertexWidths, 1) && fits(stroke.vertexColors, COLOR_STRIDE));
  if (fits(d.vertexColors, COLOR_STRIDE) && strokeFits) return data;
  const out = { ...d } as AnchorDataCarrier;
  if (!fits(d.vertexColors, COLOR_STRIDE)) delete out.vertexColors;
  if (!strokeFits && stroke) {
    const { vertexWidths, vertexColors, ...rest } = stroke;
    out.stroke = {
      ...rest,
      ...(vertexWidths && fits(vertexWidths, 1) ? { vertexWidths } : {}),
      ...(vertexColors && fits(vertexColors, COLOR_STRIDE) ? { vertexColors } : {}),
    };
  }
  return out as T;
}
