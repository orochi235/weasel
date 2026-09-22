import { resolveTextStyle } from '@weasel-js/text';
import type { TextPaint, TextStyle } from '@weasel-js/text';
import { nodeHasFlag } from './flagRange';
import type { RangeStyle } from './rangeStyle';

const FLAGS = ['bold', 'italic', 'underline', 'strikethrough', 'overline'] as const;

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
 * A node's weight reads as bold at 600 and above, as `nodeHasFlag` does.
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
