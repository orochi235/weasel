/**
 * Hit-testing for text nodes.
 *
 * `pointInTextPose` does a coarse pose-rect test — suitable for click-to-edit
 * where the pose rect is the authoritative bounding box (selection outline,
 * drag target).
 *
 * `caretIndexAt` does the finer test: given a world-space (x, y) inside the
 * pose, returns the corresponding character offset so the consumer can place
 * the caret on click. It reads the caret stops off `layoutTextPose`, the
 * layout the painters draw and `textLineBoxes` picks against, so the caret
 * cannot land on a different line — or between different glyphs — than the
 * one under the pointer.
 */

import { layoutTextPose } from '@weasel-js/text';
import type { LaidOutCell, TextPose } from '@weasel-js/text';

/**
 * Merge neighboring cells drawn from one source character — the two `S`s an
 * uppercased `ß` becomes — into one cell spanning both, so no caret stop falls
 * between them.
 */
function sourceClusters(cells: readonly LaidOutCell[]): LaidOutCell[] {
  const out: LaidOutCell[] = [];
  for (const c of cells) {
    const prev = out[out.length - 1];
    if (prev && prev.srcIndex === c.srcIndex && prev.srcEnd === c.srcEnd) {
      const x0 = Math.min(prev.x, c.x);
      const x1 = Math.max(prev.x + prev.advance, c.x + c.advance);
      out[out.length - 1] = { ...prev, x: x0, advance: x1 - x0 };
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
 * glyphs at whichever side of the advance cell's midpoint `x` falls on — the
 * standard "snap caret to nearest character boundary" rule.
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
  const cells = sourceClusters(line.cells);
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
