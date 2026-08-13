/**
 * Where a text node's lines actually sit inside its pose box.
 *
 * A text pose is a *wrap box*, not a bounding box: `"Away"` in a 309-unit-wide
 * box leaves most of the box empty, and anything that treats the pose as the
 * node's extent — picking, lasso, clipping, SVG export — claims that empty
 * space. `textLineBoxes` returns the per-line rectangles instead.
 *
 * The numbers come from `layoutRuns`, the same walk that positions the glyphs,
 * through the same `resolveTextStyle` → `resolveRuns` → `layoutRuns` chain as
 * `textCommand` — so the boxes cannot drift from what is painted. In
 * particular they honor `align` (a centered line reports its own span, not the
 * wrap width) and `verticalAlign` (the block shifts inside `[y, y + height]`
 * exactly as `drawText` shifts the quads).
 *
 * These are line boxes, not ink boxes: each is `fontSize * lineHeight` tall
 * from the pen's line top. Ink can escape vertically at a `lineHeight` low
 * enough — see the `bounds` note at the end of `layoutRuns` — which is the
 * right trade for hit-testing, where a box that hugged the ink would make
 * an `x` harder to click than an `X`.
 */

import type { Rect } from 'core/geometry/polygonHitTestRect';
import { resolveTextStyle } from './textStyle';
import { resolveRuns } from './runs/resolveRuns';
import { toRuns } from './runs';
import { layoutRuns } from './atlas/layoutRuns';
import { verticalAlignOffset } from './verticalAlign';
import type { TextPose } from './textLayer';

/** Options for {@link textLineBoxes}. */
export interface TextLineBoxesOpts {
  /** Grow every box by this much on all four sides (world units). Default 0.
   *  Picking wants a little slack so a single hairline row of text is still
   *  grabbable; clipping and export want none. */
  padding?: number;
  /** Keep boxes for blank lines (zero width). Default `false` — a blank line
   *  covers no area, so for hit-testing and silhouettes it is noise. Pass
   *  `true` when the indices have to line up with the wrapped lines. */
  includeEmpty?: boolean;
  /**
   * Wrap width. Default `pose.width`, which is what `createTextLayer` passes
   * and what `TextPose` means by its box.
   *
   * Pass `Infinity` for a node painted by the built-in `kit:text` painter:
   * that painter deliberately does **not** forward `maxWidth` (see
   * `NodeShape.ts`), so its text does not wrap, and boxes computed with a
   * finite width would wrap where the paint did not.
   */
  maxWidth?: number;
}

/** Per-line rectangles for a text pose, in world units, in layout order. */
export function textLineBoxes(pose: TextPose, opts: TextLineBoxesOpts = {}): Rect[] {
  const padding = opts.padding ?? 0;
  const style = resolveTextStyle(pose.style);
  // `runs` wins when non-empty, matching every painter: empty runs are not a
  // styling, so they fall back to the plain string rather than measure nothing.
  const source = pose.runs && pose.runs.length > 0 ? pose.runs : pose.text;
  const runs = resolveRuns(toRuns(source), style);
  const laid = layoutRuns(runs, {
    maxWidth: opts.maxWidth ?? pose.width,
    lineHeight: style.lineHeight,
    align: style.align,
  });
  // The same translate `drawText` applies to the quads — `layoutRuns` is
  // origin-relative, so the pose's position lands here — plus the
  // `verticalAlign` shift, so the boxes stay on the text under every setting
  // rather than only the default 'top'.
  const dx = pose.x;
  const dy = pose.y + verticalAlignOffset(pose.verticalAlign, pose.height, laid.bounds.height);

  const out: Rect[] = [];
  for (const line of laid.lines) {
    if (!opts.includeEmpty && line.x1 <= line.x0) continue;
    out.push({
      x: line.x0 + dx - padding,
      y: line.y0 + dy - padding,
      width: line.x1 - line.x0 + padding * 2,
      height: line.y1 - line.y0 + padding * 2,
    });
  }
  return out;
}
