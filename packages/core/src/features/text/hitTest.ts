/**
 * Hit-testing for text nodes.
 *
 * `pointInTextPose` does a coarse pose-rect test — suitable for click-to-edit
 * where the pose rect is the authoritative bounding box (selection outline,
 * drag target).
 *
 * `caretIndexAt` does the finer test: given a world-space (x, y) inside the
 * pose, returns the corresponding character offset in `pose.text` so the
 * consumer can place the caret on click. Re-runs the wrap to map the click
 * back through `lineStarts`; respects `style.align` for line anchoring.
 */

import { measureText } from './measureText';
import { fontString, resolveTextStyle } from './textStyle';
import type { TextPose } from './textLayer';

/** Options for `pointInTextPose`. */
export interface PointInTextPoseOpts {
  /** Extra padding (world units) added to the rect on all sides. Default 0. */
  padding?: number;
}

/** Coarse pose-rect hit-test for a text node — suitable for click-to-edit dispatch. */
export function pointInTextPose(
  x: number,
  y: number,
  pose: TextPose,
  opts: PointInTextPoseOpts = {},
): boolean {
  const p = opts.padding ?? 0;
  return (
    x >= pose.x - p &&
    x <= pose.x + pose.width + p &&
    y >= pose.y - p &&
    y <= pose.y + pose.height + p
  );
}

/**
 * Map a world-space point inside `pose` to a character offset into
 * `pose.text` (0..text.length). Clicks above the first line clamp to 0;
 * clicks below the last line clamp to `text.length`. Within a line, the
 * caret lands between two glyphs at whichever side of the glyph midpoint
 * `x` falls on — the standard "snap caret to nearest character boundary"
 * rule.
 *
 * The `ctx` is used only for `measureText`; its `font` is set internally
 * to match the resolved text style. Pass any 2D context (the same one used
 * to render is fine).
 */
export function caretIndexAt(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  pose: TextPose,
): number {
  const style = resolveTextStyle(pose.style);
  ctx.save();
  ctx.font = fontString(style);
  try {
    const wrapped = measureText(ctx, pose.text, pose.width, style);
    if (wrapped.lines.length === 0) return 0;

    const lineHeightPx = style.fontSize * style.lineHeight;
    const rawLine = Math.floor((y - pose.y) / lineHeightPx);
    if (rawLine < 0) return 0;
    if (rawLine >= wrapped.lines.length) return pose.text.length;

    const line = wrapped.lines[rawLine];
    const lineStart = wrapped.lineStarts[rawLine];
    // `letter-spacing` is not part of the CSS `font` shorthand, so setting
    // `ctx.font = fontString(style)` above never carries it — tracking has to
    // be added to the measured advances by hand or the caret drifts further
    // from the pointer with every glyph. Applied after *every* character
    // including the last, matching CSS and `layoutRuns`.
    const tracking = style.letterSpacing;
    const lineWidth = ctx.measureText(line).width + line.length * tracking;

    let xLeft: number;
    switch (style.align) {
      case 'right':
        xLeft = pose.x + pose.width - lineWidth;
        break;
      case 'center':
        xLeft = pose.x + (pose.width - lineWidth) / 2;
        break;
      default:
        xLeft = pose.x;
    }

    if (x <= xLeft) return lineStart;

    let cursor = xLeft;
    for (let i = 0; i < line.length; i++) {
      // Snap on the midpoint of the glyph's full advance cell (glyph + its
      // trailing tracking), which is the step the pen actually takes.
      const step = ctx.measureText(line[i]).width + tracking;
      if (x < cursor + step / 2) return lineStart + i;
      cursor += step;
    }
    return lineStart + line.length;
  } finally {
    ctx.restore();
  }
}
