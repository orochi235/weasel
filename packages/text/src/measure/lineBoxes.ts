/**
 * Where a text node's lines actually sit inside its pose box.
 *
 * A text pose is a layout box, not a bounding box: `"Away"` in a 309-unit-wide
 * box leaves most of the box empty, and anything that treats the pose as the
 * node's extent — picking, lasso, clipping, SVG export — claims that empty
 * space. `textLineBoxes` returns the per-line rectangles instead.
 *
 * The numbers come from `layoutTextPose`, the layout every painter of a text
 * pose draws, so the boxes cannot drift from what is painted — they wrap only
 * where the style declares `wrap`, and honor `align` and `verticalAlign`.
 *
 * These are line boxes, not ink boxes: each is `fontSize * lineHeight` tall
 * from the pen's line top. Ink can escape vertically at a `lineHeight` low
 * enough — see the `bounds` note at the end of `layoutRuns` — which is the
 * right trade for hit-testing, where a box that hugged the ink would make
 * an `x` harder to click than an `X`.
 */

import type { Rect } from '@weasel-js/geom';
import { layoutTextPose } from '../layout/textPoseLayout';
import type { TextPose } from '../pose';

/** Options for {@link textLineBoxes}. */
export interface TextLineBoxesOpts {
  /** Grow every box by this much on all four sides (world units). Default 0.
   *  Picking wants a little slack so a single hairline row of text is still
   *  grabbable; clipping and export want none. */
  padding?: number;
  /** Keep boxes for blank lines (zero width). Default `false` — a blank line
   *  covers no area, so for hit-testing and silhouettes it is noise. Pass
   *  `true` when the indices have to line up with the laid-out lines. */
  includeEmpty?: boolean;
}

/** Per-line rectangles for a text pose, in world units, in layout order. */
export function textLineBoxes(pose: TextPose, opts: TextLineBoxesOpts = {}): Rect[] {
  const padding = opts.padding ?? 0;
  const { laid, x: dx, y: dy } = layoutTextPose(pose);

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
