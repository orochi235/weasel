import type { TextStyle } from './textStyle';
import { resolveTextStyle } from './textStyle';
import { resolveRuns } from './runs/resolveRuns';
import { layoutRuns } from './atlas/layoutRuns';

/**
 * Measure how the GL/MSDF renderer will lay out a single plain-text string,
 * using the registered font atlas metrics. Mirrors {@link textCommand} exactly
 * (`resolveTextStyle` → `resolveRuns` → `layoutRuns`), so the returned bounds
 * match what actually gets drawn — use it to size backgrounds/pills, place
 * labels, or test overlap without guessing widths.
 *
 * Returns `{ width, height }` in the same units as `style.fontSize`. The font
 * must already be registered via `registerFont`; an unregistered family falls
 * back to the atlas fallback glyph (and warns), so register fonts at app boot
 * before measuring.
 */
export function measureTextBounds(
  text: string,
  style?: TextStyle,
): { width: number; height: number } {
  const resolved = resolveTextStyle(style);
  const runs = resolveRuns([{ text }], resolved);
  const { bounds } = layoutRuns(
    runs,
    { maxWidth: Infinity, lineHeight: resolved.lineHeight, align: resolved.align },
    { x: 0, y: 0 },
  );
  return bounds;
}
