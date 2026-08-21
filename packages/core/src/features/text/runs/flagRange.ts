/**
 * Turning a run-level flag **off** inside a node that sets it.
 *
 * Run flags are additive over the node's `TextStyle` — a run turns `bold` /
 * `italic` / `underline` / `strikethrough` on, never off (see the contract at
 * the top of `rangeStyle.ts`). So "select a word inside an underlined node and
 * hit U" is unrepresentable by the stored shape, and the character bar can
 * only refuse.
 *
 * This resolves it by rewriting rather than by widening the model: clear the
 * flag on the node, and set it on every run *outside* the range. The rendered
 * result is identical and the edit becomes expressible, with `StyledRun`
 * unchanged — so nothing a document can already contain changes meaning, which
 * matters while the flags are heading for a persisted format.
 *
 * The alternative was a tri-state run flag (`true` / `false` / inherit). It
 * cannot cover `bold` or `italic`: those are booleans on a run but
 * `fontWeight` and `fontStyle` on the node, so a run's `false` has no node-level
 * boolean to override. Tri-state fixes two of the four flags; this fixes all
 * four.
 */

import type { StyledRun } from '../runs';
import type { TextStyle } from '../textStyle';
import { applyStyleToRange } from './rangeStyle';

/** The additive run flags. */
export type FlagKey = 'bold' | 'italic' | 'underline' | 'strikethrough';

/** The result of toggling a style flag over a text range: the rewritten runs
 *  and node style, and whether the change could be made at all. */
export interface SetFlagResult {
  runs: StyledRun[];
  style: TextStyle;
  /**
   * False when the node flag could not be lowered without changing what is
   * drawn, and nothing was written. The only case is a `fontWeight` the run
   * boolean cannot express: `run.bold` resolves to exactly 700 everywhere, so
   * a node at 900 cannot have its weight pushed onto its runs. Callers should
   * disable the control rather than apply a silent downgrade.
   */
  applied: boolean;
}

/** Does the node style carry this flag? */
export function nodeHasFlag(style: TextStyle, key: FlagKey): boolean {
  switch (key) {
    case 'bold': return isBoldWeight(style.fontWeight);
    case 'italic': return style.fontStyle === 'italic';
    case 'underline': return style.underline === true;
    case 'strikethrough': return style.strikethrough === true;
  }
}

function isBoldWeight(w: TextStyle['fontWeight']): boolean {
  if (w === undefined) return false;
  if (typeof w === 'number') return w >= 600;
  return w === 'bold' || w === 'bolder';
}

/** Can `run.bold` reproduce this node weight exactly? It resolves to 700. */
function weightIsExpressibleAsRunBold(w: TextStyle['fontWeight']): boolean {
  return w === 700 || w === 'bold';
}

/** The node style with `key` cleared. */
function clearNodeFlag(style: TextStyle, key: FlagKey): TextStyle {
  const next = { ...style };
  switch (key) {
    case 'bold': next.fontWeight = 400; break;
    case 'italic': next.fontStyle = 'normal'; break;
    case 'underline': delete next.underline; break;
    case 'strikethrough': delete next.strikethrough; break;
  }
  return next;
}

/**
 * Set `key` to `value` over `[start, end)`.
 *
 * Turning a flag **on**, or off in a node that doesn't set it, is the ordinary
 * additive write and leaves `style` alone. Turning it off in a node that *does*
 * set it takes the rewrite: the node flag is cleared and the flag is written
 * onto the complement of the range.
 *
 * `runs` is normalized on every path, so the complement collapses back to one
 * run when the range is empty and the whole array coalesces as usual.
 */
export function setFlagOverRange(
  runs: readonly StyledRun[],
  style: TextStyle,
  start: number,
  end: number,
  key: FlagKey,
  value: boolean,
): SetFlagResult {
  if (value || !nodeHasFlag(style, key)) {
    return {
      runs: applyStyleToRange(runs, start, end, { [key]: value }),
      style,
      applied: true,
    };
  }

  if (key === 'bold' && !weightIsExpressibleAsRunBold(style.fontWeight)) {
    return { runs: [...runs], style, applied: false };
  }

  const total = runs.reduce((n, r) => n + r.text.length, 0);
  const lo = Math.max(0, start);
  const hi = Math.min(total, end);

  // Raise the flag on everything, then lower it over the range. Doing it in
  // that order rather than patching the two complement spans keeps one code
  // path for a range at either edge, where one span is empty.
  let next = applyStyleToRange(runs, 0, total, { [key]: true });
  if (lo < hi) next = applyStyleToRange(next, lo, hi, { [key]: false });

  return { runs: next, style: clearNodeFlag(style, key), applied: true };
}
