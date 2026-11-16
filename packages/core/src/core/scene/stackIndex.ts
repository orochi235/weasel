/** `index` held to `[0, max]`, ±Infinity meaning either end. Throws on NaN, which has no end to be held to. */
export function heldIndex(index: number, max: number, caller: string): number {
  if (Number.isNaN(index)) {
    throw new RangeError(`${caller}: index is NaN. Pass a number; an index past either end, ±Infinity included, is held to it.`);
  }
  return Math.max(0, Math.min(index, max));
}
