/** `value` as a `color-mix()` percentage, or a `RangeError` naming the `effect` and `param`: `color-mix()` rejects one outside 0..100. */
export function mixPercent(value: number, param: string, effect: string): number {
  if (value >= 0 && value <= 100) return value;
  throw new RangeError(`a ${effect} effect's ${param} must be from 0 to 100, not ${value}`);
}
