/**
 * Where a keystroke of `delta` takes a thumb at `from` when the move meets an
 * end of the slider's finite `range`, or `null` when it stays inside. An
 * endless end's stop lies on the `track` beyond the range, at a distance drawn
 * for the eye; to the keyboard it is one press past the range's end. A move
 * that would overshoot the end lands on the end first.
 */
export function crossEnd(
  from: number,
  delta: number,
  stepSize: number,
  range: readonly [number, number],
  track: readonly [number, number],
): number | null {
  const [lo, hi] = range;
  if (from > hi) return delta < 0 ? hi + delta + stepSize : from;
  if (from < lo) return delta > 0 ? lo + delta - stepSize : from;
  if (from + delta > hi) return from < hi ? hi : track[1];
  if (from + delta < lo) return from > lo ? lo : track[0];
  return null;
}
