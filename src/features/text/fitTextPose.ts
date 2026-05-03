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

import { measureText } from './measureText';
import { fontString, resolveTextStyle } from './textStyle';
import type { TextPose } from './textLayer';

/** Options for `fitTextPose`. */
export interface FitTextPoseOptions {
  /** Which axis (or axes) to recompute. Default: `'height'`. */
  axis?: 'height' | 'both';
  /** Padding (world units) added to all four sides. Default 0. */
  padding?: number | { x?: number; y?: number };
}

/** Recompute a `TextPose`'s `width`/`height` to fit its content; pure helper, doesn't mutate scene state. */
export function fitTextPose(
  ctx: CanvasRenderingContext2D,
  pose: TextPose,
  opts: FitTextPoseOptions = {},
): TextPose {
  const axis = opts.axis ?? 'height';
  const { padX, padY } = resolvePadding(opts.padding);
  const style = resolveTextStyle(pose.style);
  ctx.save();
  ctx.font = fontString(style);
  try {
    const lineHeightPx = style.fontSize * style.lineHeight;
    if (axis === 'height') {
      const measured = measureText(ctx, pose.text, pose.width - padX * 2, style);
      return { ...pose, height: measured.height + padY * 2 };
    }
    // axis === 'both'
    const lines = pose.text.split('\n');
    let maxWidth = 0;
    for (const line of lines) {
      const w = ctx.measureText(line).width;
      if (w > maxWidth) maxWidth = w;
    }
    return {
      ...pose,
      width: maxWidth + padX * 2,
      height: lines.length * lineHeightPx + padY * 2,
    };
  } finally {
    ctx.restore();
  }
}

function resolvePadding(p: FitTextPoseOptions['padding']): { padX: number; padY: number } {
  if (p == null) return { padX: 0, padY: 0 };
  if (typeof p === 'number') return { padX: p, padY: p };
  return { padX: p.x ?? 0, padY: p.y ?? 0 };
}
