/** Whether `value` is a number other than `NaN` and the infinities. `Number.isFinite` answers the same but narrows
 *  nothing, so a value read as `unknown` stays unknown after it. */
export function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}
