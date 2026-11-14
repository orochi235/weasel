/** How {@link niceStep} rounds: `'up'` never goes under, `'down'` never over, and `'nearest'` takes the closer by
 *  ratio, as an axis asking for about five ticks does. */
export type NiceRounding = 'up' | 'down' | 'nearest';

const LADDER = [1, 2, 5, 10] as const;
/** The ratios halfway between neighbors on the ladder. */
const MIDPOINTS = [Math.SQRT2, Math.sqrt(10), Math.sqrt(50)];

/**
 * `rough` rounded to 1, 2 or 5 times a power of ten: the step of a tick grid, a scale bar's length. A `rough` that
 * is not a positive finite number comes back as it is. Rounded past the largest double, `'up'` gives `rough` back,
 * still never under it, and `'nearest'` its power of ten.
 */
export function niceStep(rough: number, rounding: NiceRounding = 'up'): number {
  if (!(rough > 0) || !Number.isFinite(rough)) return rough;
  let power = 10 ** Math.floor(Math.log10(rough));
  if (!(power > 0)) return rough;
  // log10 can round across a decade boundary; put the ratio back in 1..10.
  if (rough / power < 1) power /= 10;
  else if (rough / power >= 10) power *= 10;
  const norm = rough / power;
  let i: number;
  if (rounding === 'up') i = LADDER.findIndex((s) => norm <= s);
  else if (rounding === 'down') i = LADDER.length - 1 - [...LADDER].reverse().findIndex((s) => norm >= s);
  else i = MIDPOINTS.filter((m) => norm >= m).length;
  const step = LADDER[i]! * power;
  return Number.isFinite(step) ? step : rounding === 'up' ? rough : power;
}
