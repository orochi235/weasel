import type { PrefSection } from '@weasel-js/prefs';
import { decimal } from '@weasel-js/quantity';
import { SHAPE_COUNT_RANGE, STAR_RATIO_RANGE } from 'domains/paths/shapeGenerator';

const WHOLE = decimal({ maxPlaces: 2, grouping: false });

/**
 * The rows that edit a polygon's or a star's `data.generator`, each shown only
 * on a node holding that kind's generator. A write to one regenerates the
 * shape through the entry's `settle` (`settleShapeGenerator`).
 */
export const SHAPE_GENERATOR_SECTIONS: Record<string, PrefSection> = {
  polygon: {
    name: 'Polygon',
    showIf: { path: 'data.generator.sides' },
    members: {
      'data.generator.sides': {
        kind: 'number', display: WHOLE, name: 'Sides', description: 'Number of sides.',
        default: 6, min: SHAPE_COUNT_RANGE.min, max: SHAPE_COUNT_RANGE.max, step: 1,
      },
    },
  },
  star: {
    name: 'Star',
    showIf: { path: 'data.generator.points' },
    members: {
      'data.generator.points': {
        kind: 'number', display: WHOLE, name: 'Points', description: 'Number of points.',
        default: 5, min: SHAPE_COUNT_RANGE.min, max: SHAPE_COUNT_RANGE.max, step: 1,
      },
      'data.generator.innerRadiusRatio': {
        kind: 'number', name: 'Inner radius', description: 'Inner radius as a fraction of the outer one.',
        default: 0.5, min: STAR_RATIO_RANGE.min, max: STAR_RATIO_RANGE.max, step: 0.01, control: 'slider',
      },
    },
  },
};
