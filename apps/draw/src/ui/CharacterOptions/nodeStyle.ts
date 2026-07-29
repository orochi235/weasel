/**
 * Bridge between the caret-range vocabulary (`RangeStyle` / `RunStylePatch`,
 * keyed like a `StyledRun`) and the node-level one (`TextStyle`).
 *
 * The options bar speaks the first. With a collapsed caret there is no range
 * to style, so the same controls have to reach the node's own `TextStyle`
 * instead — which is *nearly* the same vocabulary, with one real difference:
 *
 * **A run's `bold` is a boolean; a node's `fontWeight` is a number.** So the
 * translation buckets, `>= 600` in and `700` / `400` out. A node at weight
 * 500 reads back as not-bold, and toggling bold off a node at 900 lands it at
 * 400 rather than at "one step lighter". That is the same bucket the font
 * fallback itself applies (`weightBucket` in `registerFont`), so the control
 * cannot promise finer resolution than the renderer delivers — the numeric
 * weight leaf in the sidebar is where a document sets an exact value.
 *
 * `italic` is a clean round-trip (both sides are two-valued), as are
 * `fontFamily`, `fontSize`, `letterSpacing`, `underline`, `strikethrough`,
 * and `fill`.
 *
 * Nothing here is `MIXED`-aware: a single node has one style, and `MIXED`
 * only arises from aggregating several sources.
 */
import { resolveTextStyle } from '@weasel-js/core';
import type { RangeStyle, RunStylePatch, TextStyle } from '@weasel-js/core';

/** Weight at or above which a node reads as bold — the fallback's own bucket. */
const BOLD_THRESHOLD = 600;

/** What the bar should display for a node with no range selected. */
export function rangeStyleFromTextStyle(style: TextStyle | undefined): RangeStyle {
  if (!style) return {};
  const out: RangeStyle = {};
  const weight = typeof style.fontWeight === 'number' ? style.fontWeight : undefined;
  if (weight !== undefined) out.bold = weight >= BOLD_THRESHOLD;
  if (style.fontStyle !== undefined) out.italic = style.fontStyle === 'italic';
  if (style.fontFamily !== undefined) out.fontFamily = style.fontFamily;
  if (style.fontSize !== undefined) out.fontSize = style.fontSize;
  if (style.letterSpacing !== undefined) out.letterSpacing = style.letterSpacing;
  if (style.underline !== undefined) out.underline = style.underline;
  if (style.strikethrough !== undefined) out.strikethrough = style.strikethrough;
  if (style.fill !== undefined) out.fill = style.fill;
  return out;
}

/** The additive run flags — the keys whose inheritance is `||`, not `??`. */
const FLAGS = ['bold', 'italic', 'underline', 'strikethrough'] as const;

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
): RangeStyle {
  // `ResolvedTextStyle` widens two overlay-only fields to `| null`, which
  // `TextStyle` doesn't allow. Neither is read here.
  const base = rangeStyleFromTextStyle(resolveTextStyle(style) as TextStyle);
  if (range === null) return base;
  const out: RangeStyle = { ...base };
  for (const key of FLAGS) {
    if (base[key] === true) continue;      // node turns it on for everything
    if (range[key] !== undefined) out[key] = range[key];
  }
  for (const key of ['fontFamily', 'fontSize', 'letterSpacing', 'fill'] as const) {
    if (range[key] !== undefined) (out as Record<string, unknown>)[key] = range[key];
  }
  return out;
}

/** The `TextStyle` fields a bar patch sets. Merge over the node's current style. */
export function textStyleFromPatch(patch: RunStylePatch): TextStyle {
  const out: TextStyle = {};
  if (patch.bold !== undefined) out.fontWeight = patch.bold ? 700 : 400;
  if (patch.italic !== undefined) out.fontStyle = patch.italic ? 'italic' : 'normal';
  if (patch.fontFamily !== undefined) out.fontFamily = patch.fontFamily;
  if (patch.fontSize !== undefined) out.fontSize = patch.fontSize;
  if (patch.letterSpacing !== undefined) out.letterSpacing = patch.letterSpacing;
  if (patch.underline !== undefined) out.underline = patch.underline;
  if (patch.strikethrough !== undefined) out.strikethrough = patch.strikethrough;
  if (patch.fill !== undefined) out.fill = patch.fill;
  return out;
}
