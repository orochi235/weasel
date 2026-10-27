/**
 * Hit-testing for text nodes. `caretIndexAt` reads the caret stops off
 * `layoutTextPose`, the layout the painters draw and `textLineBoxes` picks
 * against, so the caret cannot land on a different line — or between different
 * glyphs — than the one under the pointer.
 */

import type { LaidOutCell } from './layout/layoutRuns';
import { layoutTextPose } from './layout/textPoseLayout';
import type { TextPose } from './pose';

/**
 * Merge neighboring cells a caret cannot stop between into one cell spanning
 * them: the cells of one grapheme cluster (a letter and its combining mark,
 * the parts of a joined emoji), and cells drawn from one source character
 * (the two `S`s an uppercased `ß` becomes).
 */
function caretCells(cells: readonly LaidOutCell[]): LaidOutCell[] {
  const out: LaidOutCell[] = [];
  for (const c of cells) {
    const prev = out[out.length - 1];
    if (prev && (!prev.clusterEnd || (prev.srcIndex === c.srcIndex && prev.srcEnd === c.srcEnd))) {
      // A zero-width cell (a combining mark) sits where the pen was before
      // kerning pulled the next glyph back, so it must not stretch the span.
      const [x0, x1] = c.advance === 0 ? [prev.x, prev.x + prev.advance]
        : prev.advance === 0 ? [c.x, c.x + c.advance]
        : [Math.min(prev.x, c.x), Math.max(prev.x + prev.advance, c.x + c.advance)];
      out[out.length - 1] = {
        ...prev, x: x0, advance: x1 - x0,
        srcIndex: Math.min(prev.srcIndex, c.srcIndex), srcEnd: Math.max(prev.srcEnd, c.srcEnd),
        clusterEnd: c.clusterEnd,
      };
    } else {
      out.push(c);
    }
  }
  return out;
}

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
 * Map a world-space point inside `pose` to a character offset into the pose's
 * text (0..length). Clicks above the first line clamp to 0; clicks below the
 * last line clamp to the end. Within a line, the caret lands between two
 * glyphs at whichever side of the advance cell's midpoint `x` falls on.
 *
 * Honors `pose.runs` (a mixed-size line snaps on the cells each run actually
 * produced) and `pose.verticalAlign`. The offset is into the runs'
 * concatenated text, which `TextPose` requires to equal `pose.text`.
 */
export function caretIndexAt(x: number, y: number, pose: TextPose): number {
  const { laid, x: dx, y: dy } = layoutTextPose(pose);
  const lines = laid.lines;
  if (lines.length === 0) return 0;

  const last = lines[lines.length - 1];
  if (y < dy + lines[0].y0) return lines[0].cells[0]?.srcIndex ?? lines[0].srcEnd;
  if (y >= dy + last.y1) return last.srcEnd;

  let line = last;
  for (const candidate of lines) {
    if (y < dy + candidate.y1) { line = candidate; break; }
  }

  // Cells are in logical order and their x values need not ascend, so the
  // sweep has to be in visual order and each cell's own extent is what it is
  // tested against — the next cell along is not its right edge.
  if (line.cells.length === 0) return line.srcEnd;
  const cells = caretCells(line.cells);
  const visual = cells.map((_, i) => i).sort((a, b) => cells[a].x - cells[b].x);

  for (const i of visual) {
    const c = cells[i];
    if (x >= dx + c.x + c.advance / 2) continue;
    // A right-to-left cell reads the other way, so its visually-leading half
    // is the character's logical end.
    return c.level % 2 === 1 ? c.srcEnd : c.srcIndex;
  }
  const trailing = cells[visual[visual.length - 1]];
  return trailing.level % 2 === 1 ? trailing.srcIndex : trailing.srcEnd;
}
