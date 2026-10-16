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
  const colors = (values: number[]) => remapAnchorValues(values, COLOR_STRIDE, before, after, origins);
  const patch: AnchorDataCarrier = {};
  if (d.skin) patch.skin = remapSkin(d.skin, origins);
  if (d.vertexColors) patch.vertexColors = colors(d.vertexColors);
  if (d.stroke?.vertexColors) patch.stroke = { ...d.stroke, vertexColors: colors(d.stroke.vertexColors) };
  return patch as Record<string, unknown>;
}
