import { isBoldWeight, numericWeight, resolveTextStyle } from '@weasel-js/text';
import type { TextPaint, TextStyle } from '@weasel-js/text';
import { nodeHasFlag } from './flagRange';
import { MIXED } from './rangeStyle';
import type { Mixed, RangeStyle } from './rangeStyle';

const FLAGS = ['italic', 'underline', 'strikethrough', 'overline'] as const;

/**
 * The weight a range renders at, and whether that reads as bold, resolved as
 * `resolveRuns` resolves a run: its own `fontWeight`, else 700 for `bold`,
 * else the node's weight.
 */
export function rangeWeight(
  range: RangeStyle | null,
  style: TextStyle | undefined,
): { fontWeight: number | Mixed; bold: boolean | Mixed } {
  const node = numericWeight(style?.fontWeight ?? 400);
  const own = range?.fontWeight;
  if (own === MIXED) return { fontWeight: MIXED, bold: MIXED };
  if (own !== undefined) return { fontWeight: own, bold: isBoldWeight(own) };
  const flag = range?.bold;
  if (flag === MIXED) {
    // Flagged runs draw at 700, the rest at the node's weight.
    if (node === 700) return { fontWeight: 700, bold: true };
    return { fontWeight: MIXED, bold: isBoldWeight(node) ? true : MIXED };
  }
  const weight = flag === true ? 700 : node;
  return { fontWeight: weight, bold: isBoldWeight(weight) };
}

/** Keys a run overrides outright. `script` and the two primitives it presets
 *  have no node-level counterpart, so they only ever come from the range. */
const OVERRIDES = [
  'fontFamily', 'fontSize', 'letterSpacing', 'fill', 'script', 'baselineShift', 'fontScale',
  'textTransform',
] as const;

/**
 * What is actually rendering across a range: `range` (from `styleAtRange`,
 * or `useTextEdit`'s `rangeStyle`) resolved against the node's own `style`
 * and `paint`, as the canvas resolves runs. `null` reads the node alone.
 *
 * Flags are additive — a run can turn one on, never off — so a node flag
 * makes the flag `true` across the range, `MIXED` runs included. Every other
 * key is the run's value where the range sets one, otherwise the node's.
 * The node level is resolved first, so the result has a value for every
 * key but the run-only ones, and for `fill` unless the node is unfilled.
 * Bold is read off the weight that renders (see {@link rangeWeight}), since
 * a run's own `fontWeight` can take a bold node's text back to regular.
 */
export function effectiveRangeStyle(
  range: RangeStyle | null,
  style: TextStyle | undefined,
  paint?: TextPaint,
): RangeStyle {
  const resolved = resolveTextStyle(style, paint);
  const node = style ?? {};
  const out: RangeStyle = {
    fontFamily: resolved.fontFamily,
    fontSize: resolved.fontSize,
    letterSpacing: resolved.letterSpacing,
    textTransform: resolved.textTransform,
  };
  if (resolved.fill !== null) out.fill = resolved.fill;
  Object.assign(out, rangeWeight(range, style));
  for (const key of FLAGS) {
    const on = nodeHasFlag(node, key);
    const run = range?.[key];
    out[key] = on || run === undefined ? on : run;
  }
  if (range === null) return out;
  for (const key of OVERRIDES) {
    if (range[key] !== undefined) (out as Record<string, unknown>)[key] = range[key];
  }
  return out;
}
