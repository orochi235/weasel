import type { TextStyle } from '../textStyle';
import { resolveTextStyle } from '../textStyle';
import { resolveRuns } from '../runs/resolveRuns';
import { layoutRuns } from '../layout/layoutRuns';

/** Options for `measureTextBounds`. */
export interface MeasureTextBoundsOpts {
  /** Wrap width; words exceeding it start a new line. Default `Infinity` (no wrap). */
  maxWidth?: number;
  /** Overrides `style`'s `lineHeight` multiplier for this measurement. */
  lineHeight?: number;
}

/**
 * Measure how the GL/MSDF renderer will lay out a single plain-text string,
 * using the registered font atlas metrics. Mirrors {@link textCommand} exactly
 * (`resolveTextStyle` → `resolveRuns` → `layoutRuns`), so the returned bounds
 * match what actually gets drawn — use it to size backgrounds/pills, place
 * labels, or test overlap without guessing widths.
 *
 * Pass `opts.maxWidth` to measure word-wrapped height (e.g. for a fixed-width
 * text box); omitting it measures the unwrapped single-line width. `opts.lineHeight`
 * overrides the style's multiplier without changing `style` itself.
 *
 * Returns `{ width, height }` in the same units as `style.fontSize`. The font
 * must already be registered via `registerFont`; an unregistered family falls
 * back to the atlas fallback glyph (and warns), so register fonts at app boot
 * before measuring.
 */
export function measureTextBounds(
  text: string,
  style?: TextStyle,
  opts?: MeasureTextBoundsOpts,
): { width: number; height: number } {
  const resolved = resolveTextStyle(style);
  const runs = resolveRuns([{ text }], resolved);
  const { bounds } = layoutRuns(runs, {
    maxWidth: opts?.maxWidth ?? Infinity,
    lineHeight: opts?.lineHeight ?? resolved.lineHeight,
    align: resolved.align,
  });
  return bounds;
}
