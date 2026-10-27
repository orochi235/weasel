import type { TextStyle } from '../textStyle';
import { resolveTextStyle } from '../textStyle';
import { resolveRuns } from '../runs/resolveRuns';
import { cachedLayoutRuns } from '../layout/layoutCache';

/** Options for `measureTextBounds`. */
export interface MeasureTextBoundsOpts {
  /** Wrap width; words exceeding it start a new line. Default `Infinity` (no wrap). */
  maxWidth?: number;
  /** Overrides `style`'s `lineHeight` multiplier for this measurement. */
  lineHeight?: number;
  /** View scale any `{ px }` size in `style` resolves against. Default 1,
   *  which measures a `{ px }` size as that many world units. */
  scale?: number;
}

/**
 * Measure how the GL/MSDF renderer will lay out a single plain-text string,
 * using the registered font atlas metrics. Mirrors `textCommand` exactly, so
 * the returned bounds match what actually gets drawn.
 *
 * Returns `{ width, height }` in the same units as `style.fontSize`. The font
 * must already be registered via `registerFont`; an unregistered family falls
 * back to the atlas fallback glyph (and warns).
 */
export function measureTextBounds(
  text: string,
  style?: TextStyle,
  opts?: MeasureTextBoundsOpts,
): { width: number; height: number } {
  const resolved = resolveTextStyle(style, undefined, opts?.scale);
  const runs = resolveRuns([{ text }], resolved, opts?.scale);
  const { bounds } = cachedLayoutRuns(runs, {
    maxWidth: opts?.maxWidth ?? Infinity,
    lineHeight: opts?.lineHeight ?? resolved.lineHeight,
    align: resolved.align,
    direction: resolved.direction,
    tabSize: resolved.tabSize,
  }, 'read');
  // Copied: the layout behind it is shared, and handing a caller a mutable
  // reference into a cache entry is how one measurement corrupts the next.
  return { width: bounds.width, height: bounds.height };
}
