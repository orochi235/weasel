/**
 * Hit-testing for text nodes.
 *
 * `pointInTextPose` does a coarse pose-rect test — suitable for click-to-edit
 * where the pose rect is the authoritative bounding box (selection outline,
 * drag target).
 *
 * `caretIndexAt` does the finer test: given a world-space (x, y) inside the
 * pose, returns the corresponding character offset so the consumer can place
 * the caret on click. It reads the caret stops off the same
 * `cachedLayoutRuns` result the renderer paints and `textLineBoxes` picks
 * against, so the caret cannot land on a different line — or between
 * different glyphs — than the one under the pointer.
 */

import {
  cachedLayoutRuns, resolveRuns, resolveTextStyle, toRuns, verticalAlignOffset,
} from '@weasel-js/text';
import type { TextPose } from '@weasel-js/text';

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

/** Options for `caretIndexAt`. */
export interface CaretIndexAtOpts {
  /**
   * Wrap width. Default `pose.width`, which is what `createTextLayer` passes
   * and what `TextPose` means by its box.
   *
   * Pass `Infinity` for a node painted by the built-in `kit:text` painter:
   * that painter deliberately does not forward `maxWidth`, so its text does
   * not wrap, and a caret mapped through a finite width would answer for a
   * line break the paint never made. Mirrors `textLineBoxes`.
   */
  maxWidth?: number;
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
export function caretIndexAt(
  x: number,
  y: number,
  pose: TextPose,
  opts: CaretIndexAtOpts = {},
): number {
  const style = resolveTextStyle(pose.style);
  // `runs` wins when non-empty, matching every painter: empty runs are not a
  // styling, so they fall back to the plain string rather than measure nothing.
  const source = pose.runs && pose.runs.length > 0 ? pose.runs : pose.text;
  const runs = resolveRuns(toRuns(source), style);
  const laid = cachedLayoutRuns(runs, {
    maxWidth: opts.maxWidth ?? pose.width,
    lineHeight: style.lineHeight,
    align: style.align,
  });

  const lines = laid.lines;
  if (lines.length === 0) return 0;

  // The same translate `drawText` applies to the quads — the layout is
  // origin-relative — plus the `verticalAlign` shift.
  const dx = pose.x;
  const dy = pose.y + verticalAlignOffset(pose.verticalAlign, pose.height, laid.bounds.height);

  const last = lines[lines.length - 1];
  if (y < dy + lines[0].y0) return lines[0].cells[0]?.srcIndex ?? lines[0].srcEnd;
  if (y >= dy + last.y1) return last.srcEnd;

  let line = last;
  for (const candidate of lines) {
    if (y < dy + candidate.y1) { line = candidate; break; }
  }

  // The stop closing a line is its right edge, which is not a cell.
  const { cells } = line;
  for (let i = 0; i < cells.length; i++) {
    const next = i + 1 < cells.length ? cells[i + 1].x : line.x1;
    if (x < dx + (cells[i].x + next) / 2) return cells[i].srcIndex;
  }
  return line.srcEnd;
}
