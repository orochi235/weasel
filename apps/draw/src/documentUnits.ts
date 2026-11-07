import type { UnitScope } from '@weasel-js/core';

/** What a typed length may be written in, each as points: the document's unit, 72 to the inch. */
export const DOCUMENT_UNITS = { pt: 1, in: 72, mm: 72 / 25.4, cm: 72 / 2.54 } as const;

/** The scope the rulers read the document in: points and inches. Metric is left out so the
 *  labeled step stays in one system at every zoom. */
export const DOCUMENT_SCOPE: UnitScope = { system: { base: 'pt', units: { pt: 1, in: 72 } } };
