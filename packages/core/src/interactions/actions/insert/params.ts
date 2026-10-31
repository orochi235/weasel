import { pref, type PrefGroup } from '@weasel-js/prefs';
import { SHAPE_COUNT_RANGE, STAR_RATIO_RANGE } from 'domains/paths/shapeGenerator';
import { insertKind } from './shape';

/** A polygon insert's params as a form, for the last-operation panel. */
export const POLYGON_INSERT_PARAMS = pref.group('Polygon', {
  sides: pref.number('Sides', 6, { min: SHAPE_COUNT_RANGE.min, max: SHAPE_COUNT_RANGE.max, step: 1, control: 'slider' }),
});

/** A star insert's params as a form, for the last-operation panel. */
export const STAR_INSERT_PARAMS = pref.group('Star', {
  points: pref.number('Points', 5, { min: SHAPE_COUNT_RANGE.min, max: SHAPE_COUNT_RANGE.max, step: 1, control: 'slider' }),
  innerRadiusRatio: pref.number('Inner radius', 0.5, {
    description: 'Inner radius as a fraction of the outer one.',
    min: STAR_RATIO_RANGE.min, max: STAR_RATIO_RANGE.max, step: 0.01, control: 'slider',
    unit: { scale: 0.01, suffix: '%', precision: 0 },
  }),
});

/** The form an insert of the kind `params` names shows: a polygon's sides, a star's points and inner radius, and
 *  none for any other kind. */
export function insertParams(params: Readonly<Record<string, unknown>>): PrefGroup | null {
  const kind = insertKind(params);
  return kind === 'polygon' ? POLYGON_INSERT_PARAMS : kind === 'star' ? STAR_INSERT_PARAMS : null;
}
