import type { UnitScope } from '@weasel-js/core';
import type { UnitValue } from '@weasel-js/quantity';

/** What a typed length may be written in, each as CSS px: the document's unit, 96 to the inch,
 *  which the paper sizes are measured in and a saved SVG's unitless lengths mean. */
export const DOCUMENT_UNITS = { px: 1, pt: 96 / 72, in: 96, mm: 96 / 25.4, cm: 96 / 2.54 } as const;

/** The scope the rulers read the document in: points and inches. Metric is left out so the
 *  labeled step stays in one system at every zoom. */
export const DOCUMENT_SCOPE: UnitScope = { system: { base: 'px', units: { px: 1, pt: DOCUMENT_UNITS.pt, in: DOCUMENT_UNITS.in } } };

const ROUND = [1, 2, 5, 10, 20, 50, 100, 200, 500, 1000, 2000, 5000];

/** The labeled steps the rulers choose among: whole points and inches, so no label reads in px. */
export const RULER_LENGTHS: readonly UnitValue[] = [
  ...ROUND.map((value) => ({ value, unit: 'pt' })),
  ...ROUND.map((value) => ({ value, unit: 'in' })),
];
