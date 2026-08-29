/**
 * Resize a text node's pose to fit its content. Pure helper — does not own
 * scene state. Call it whenever the text, style, or relevant axis changes,
 * and write the returned pose back through your adapter.
 *
 * Two modes:
 *
 *   - `axis: 'height'` (default): keep `pose.width`, recompute `height` as
 *     the wrapped block height plus optional vertical padding. The common
 *     case for column-layout text — chat bubbles, sticky notes, label cards.
 *
 *   - `axis: 'both'`: ignore wrapping; recompute both `width` (longest
 *     `\n`-split line) and `height` (line count × line height) plus padding.
 *     For badges and inline labels where the rect hugs the text on both
 *     axes. Newlines are still respected.
 *
 * `pose.x` / `pose.y` are preserved. The caller picks the anchor — if you
 * want a different growth direction (e.g. anchor bottom-right), adjust
 * `x` / `y` after calling.
 */

import { cachedLayoutRuns, resolveRuns, toRuns, resolveTextStyle } from '@weasel-js/text';
import type { TextPose } from '@weasel-js/text';

/** Options for `fitTextPose`. */
export interface FitTextPoseOptions {
  /** Which axis (or axes) to recompute. Default: `'height'`. */
  axis?: 'height' | 'both';
  /** Padding (world units) added to all four sides. Default 0. */
  padding?: number | { x?: number; y?: number };
}

/** Recompute a `TextPose`'s `width`/`height` to fit its content; pure helper, doesn't mutate scene state. */
export function fitTextPose(
  pose: TextPose,
  opts: FitTextPoseOptions = {},
): TextPose {
  const axis = opts.axis ?? 'height';
  const { padX, padY } = resolvePadding(opts.padding);
  const style = resolveTextStyle(pose.style);
  const source = pose.runs && pose.runs.length > 0 ? pose.runs : pose.text;
  const { bounds } = cachedLayoutRuns(resolveRuns(toRuns(source), style), {
    maxWidth: axis === 'height' ? pose.width - padX * 2 : Infinity,
    lineHeight: style.lineHeight,
    align: style.align,
  });
  if (axis === 'height') return { ...pose, height: bounds.height + padY * 2 };
  return {
    ...pose,
    width: bounds.width + padX * 2,
    height: bounds.height + padY * 2,
  };
}

function resolvePadding(p: FitTextPoseOptions['padding']): { padX: number; padY: number } {
  if (p == null) return { padX: 0, padY: 0 };
  if (typeof p === 'number') return { padX: p, padY: p };
  return { padX: p.x ?? 0, padY: p.y ?? 0 };
}
