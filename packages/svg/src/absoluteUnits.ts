import { getOwn } from '@weasel-js/registry';

/** CSS absolute length units in px, at CSS's fixed 96 px per inch. Keys are lowercase. */
const ABSOLUTE_PX: Readonly<Record<string, number>> = {
  px: 1, in: 96, cm: 96 / 2.54, mm: 96 / 25.4, q: 96 / 101.6, pt: 96 / 72, pc: 16,
};

/** How many px one of `unit`, a lowercase CSS absolute unit, is; `undefined` for any other unit. */
export const absolutePx = (unit: string): number | undefined => getOwn(ABSOLUTE_PX, unit);
