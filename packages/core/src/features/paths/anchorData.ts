/**
 * What a node keeps per anchor or per point of its path beside the geometry,
 * carried through an anchor edit: a skin's weights, and the fill's and the
 * stroke's vertex colors. The edit says where each new point came from
 * (`editAnchorSetTracked`); everything here follows it.
 */
import { remapAnchorValues, type PointOrigin, type PolygonPath } from '@weasel-js/geom';
import type { Skin } from '@weasel-js/animator';
import { remapSkin } from '../../animation/rig/skinBinding';

/** Channels per anchor in a `vertexColors` array. */
const COLOR_STRIDE = 4;

interface AnchorDataCarrier {
  skin?: Skin;
  vertexColors?: number[];
  stroke?: { vertexColors?: number[] } | null;
}

/**
 * `data` with its per-anchor arrays renumbered for the edit from `before` to
 * `after`, or `data` itself when it holds none. Only what `data` already has
 * is written; nothing is added.
 */
export function carryAnchorData<T>(
  data: T,
  before: PolygonPath,
  after: PolygonPath,
  origins: readonly (PointOrigin | null)[],
): T {
  if (!data || typeof data !== 'object') return data;
  const d = data as AnchorDataCarrier;
  const colors = (values: number[]) => remapAnchorValues(values, COLOR_STRIDE, before, after, origins);
  const next: AnchorDataCarrier = {};
  if (d.skin) next.skin = remapSkin(d.skin, origins);
  if (d.vertexColors) next.vertexColors = colors(d.vertexColors);
  if (d.stroke?.vertexColors) next.stroke = { ...d.stroke, vertexColors: colors(d.stroke.vertexColors) };
  return Object.keys(next).length === 0 ? data : { ...data, ...next };
}
