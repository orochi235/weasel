/** Which end of a slider stands for infinity. */
export type Endless = 'min' | 'max' | 'both';

/** Whether the `max` end (`sign` 1) or the `min` end (`sign` −1) is endless. */
export function endlessAt(endless: Endless | undefined, sign: 1 | -1): boolean {
  return endless === 'both' || endless === (sign > 0 ? 'max' : 'min');
}

/** Whether `n` is an infinity that `endless` allows as a value. */
export function endlessAllows(endless: Endless | undefined, n: number): boolean {
  return (n === Infinity && endlessAt(endless, 1)) || (n === -Infinity && endlessAt(endless, -1));
}
