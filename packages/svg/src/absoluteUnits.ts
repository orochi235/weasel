/** CSS absolute length units in px, at CSS's fixed 96 px per inch. Keys are lowercase. */
export const ABSOLUTE_PX: Readonly<Record<string, number>> = Object.assign(Object.create(null), {
  px: 1, in: 96, cm: 96 / 2.54, mm: 96 / 25.4, q: 96 / 101.6, pt: 96 / 72, pc: 16,
});
