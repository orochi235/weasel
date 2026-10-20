/** What a draw-style XML style name means in a diagram, read and written from the one table each. */
import type { MarkerRef } from '@weasel-js/core';
import type { Outline } from '@weasel-js/diagram';

/** The arc size, in percent, at and past which a rounded rect has round ends and reads as a stadium. */
export const STADIUM_ARC = 50;

/** Shapes by their style name, each with the style that writes it back. */
export const SHAPES: ReadonlyArray<{ name: string; outline: Exclude<Outline, object>; write: readonly (string | [string, string | number])[] }> = [
  { name: 'rhombus', outline: 'diamond', write: ['rhombus'] },
  { name: 'ellipse', outline: 'ellipse', write: ['ellipse'] },
  { name: 'hexagon', outline: 'hexagon', write: [['shape', 'hexagon'], ['perimeter', 'hexagonPerimeter2'], ['size', 0.2]] },
  { name: 'parallelogram', outline: 'parallelogram', write: [['shape', 'parallelogram'], ['perimeter', 'parallelogramPerimeter'], ['size', 0.2]] },
  {
    name: 'trapezoid', outline: 'trapezoid',
    write: [['shape', 'trapezoid'], ['perimeter', 'trapezoidPerimeter'], ['direction', 'north'], ['size', 0.25]],
  },
];

/** Style names that draw a plain box. */
export const BOX_NAMES: ReadonlySet<string> = new Set(['rect', 'rectangle', 'text', 'label']);

/** Edge styles that route at right angles. */
export const ORTHOGONAL_EDGE_STYLES: ReadonlySet<string> = new Set(['orthogonalEdgeStyle', 'elbowEdgeStyle', 'entityRelationEdgeStyle']);

/** Arrowheads by their style name, and whether a `Fill` of `0` makes one hollow. */
const MARKERS_READ: Readonly<Record<string, { filled: MarkerRef; hollow?: MarkerRef }>> = {
  classic: { filled: 'arrow' }, classicThin: { filled: 'arrow' }, block: { filled: 'arrow', hollow: 'arrow-open' },
  blockThin: { filled: 'arrow', hollow: 'arrow-open' }, open: { filled: 'arrow-open' }, openThin: { filled: 'arrow-open' },
  diamond: { filled: 'diamond', hollow: 'diamond-hollow' }, diamondThin: { filled: 'diamond', hollow: 'diamond-hollow' },
  oval: { filled: 'circle' }, box: { filled: 'square' }, dash: { filled: 'bar' },
};

/** The marker an arrowhead style name draws as, `null` for none, or `undefined` for a name it does not know. */
export function markerOf(name: string, fill: string | undefined): MarkerRef | null | undefined {
  if (name === 'none' || name === '') return null;
  const known = MARKERS_READ[name];
  if (known === undefined) return undefined;
  return fill === '0' && known.hollow !== undefined ? known.hollow : known.filled;
}

const MARKERS_WRITE: Readonly<Record<string, readonly [string, 0 | 1]>> = {
  'arrow': ['block', 1], 'arrow-concave': ['classic', 1], 'arrow-open': ['open', 0], 'diamond': ['diamond', 1],
  'diamond-hollow': ['diamond', 0], 'circle': ['oval', 1], 'square': ['box', 1], 'bar': ['dash', 1],
};

/** The arrowhead style name and fill a marker writes as; `undefined` for a marker the format has none like. */
export function markerStyle(marker: MarkerRef | null | undefined): readonly [string, 0 | 1] | undefined {
  if (marker === null || marker === undefined) return ['none', 1];
  return MARKERS_WRITE[typeof marker === 'string' ? marker : marker.key];
}
