/**
 * Reads the node-level vocabulary (`TextStyle`) into the caret-range one
 * (`RangeStyle`, keyed like a `StyledRun`) so the options bar can *display*
 * what is actually rendering. One direction only: the bar's edits all go to
 * the runs, or to the pending style at a collapsed caret, and the node's own
 * style is the sidebar's to write.
 *
 * The two vocabularies are nearly the same, with one real difference:
 *
 * **A run's `bold` is a boolean; a node's `fontWeight` is a number.** So the
 * translation buckets at `>= 600`, the same bucket the font fallback itself
 * applies (`weightBucket` in `registerFont`) — a node at weight 500 reads
 * back as not-bold, and the numeric weight leaf in the sidebar is where a
 * document sets an exact value.
 *
 * `fill` crosses a second seam: a run holds one, a node's `TextStyle` does
 * not — a text node's fill is `data.fill`, the leaf every node kind paints
 * from. So these take the paint beside the style.
 *
 * Nothing here is `MIXED`-aware: a single node has one style, and `MIXED`
 * only arises from aggregating several sources.
 */
import { resolveTextStyle } from '@weasel-js/core';
import type { RangeStyle, TextPaint, TextStyle } from '@weasel-js/core';

/** Weight at or above which a node reads as bold — the fallback's own bucket. */
const BOLD_THRESHOLD = 600;

/** What the bar should display for a node with no range selected. */
export function rangeStyleFromTextStyle(
  style: TextStyle | undefined,
  paint?: TextPaint,
): RangeStyle {
  const out: RangeStyle = {};
  if (paint?.fill != null) out.fill = paint.fill;
  if (!style) return out;
  const weight = typeof style.fontWeight === 'number' ? style.fontWeight : undefined;
  if (weight !== undefined) out.bold = weight >= BOLD_THRESHOLD;
  if (style.fontStyle !== undefined) out.italic = style.fontStyle === 'italic';
  if (style.fontFamily !== undefined) out.fontFamily = style.fontFamily;
  if (style.fontSize !== undefined) out.fontSize = style.fontSize;
  if (style.letterSpacing !== undefined) out.letterSpacing = style.letterSpacing;
  if (style.underline !== undefined) out.underline = style.underline;
  if (style.strikethrough !== undefined) out.strikethrough = style.strikethrough;
  if (style.overline !== undefined) out.overline = style.overline;
  return out;
}

/** The additive run flags — the keys whose inheritance is `||`, not `??`. */
const FLAGS = ['bold', 'italic', 'underline', 'strikethrough', 'overline'] as const;

/** Run-only styling: `script` and the two primitives it presets have no
 *  node-level counterpart to resolve against, so they pass straight through.
 *  A whole node set as a superscript is a smaller node moved up, which the
 *  pose already says better — see `StyledRun.script`. */
const RUN_ONLY = ['script', 'baselineShift', 'fontScale'] as const;

/**
 * What is actually rendering across `range` — the values the bar should
 * show. Resolves run styling against the node's style the same way
 * `resolveRuns` does, so the control never displays a blank for a value the
 * user can plainly see on the canvas.
 *
 * The two inheritance rules differ, and both matter here:
 *
 * - **Flags are additive.** A run can turn `bold` on, never off, so the
 *   effective flag is `run || node`. A node-level flag therefore also
 *   collapses a `MIXED` range to `true`: every run renders with it whether
 *   or not the runs agree, so reporting "mixed" would describe the data
 *   rather than the text.
 * - **Everything else overrides.** A run's `fontSize` replaces the node's;
 *   absent means the node's applies.
 *
 * `resolveTextStyle` fills the node level's own gaps, so the result is
 * fully populated — every control has something true to show.
 */
export function effectiveRangeStyle(
  range: RangeStyle | null,
  style: TextStyle | undefined,
  paint?: TextPaint,
): RangeStyle {
  // `ResolvedTextStyle` widens two overlay-only fields to `| null`, which
  // `TextStyle` doesn't allow. Neither is read here.
  const resolved = resolveTextStyle(style, paint);
  const base = rangeStyleFromTextStyle(resolved as TextStyle, { fill: resolved.fill });
  if (range === null) return base;
  const out: RangeStyle = { ...base };
  for (const key of FLAGS) {
    if (base[key] === true) continue;      // node turns it on for everything
    if (range[key] !== undefined) out[key] = range[key];
  }
  for (const key of ['fontFamily', 'fontSize', 'letterSpacing', 'fill', ...RUN_ONLY] as const) {
    if (range[key] !== undefined) (out as Record<string, unknown>)[key] = range[key];
  }
  return out;
}
