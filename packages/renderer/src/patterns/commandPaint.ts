/**
 * A node's paint, resolved into what a draw command takes. One place composes
 * the two resolutions so every painter and layer applies both.
 */

import type { CommandFill, CommandPaint, CommandStroke, Fill, Paint, Stroke } from '@weasel-js/paint';
import { fillInPoseFrame, type FillPoseBox } from '../fillInPoseFrame';
import { resolveFillPattern } from './resolveSpec';

/**
 * `paint` as a draw command's paint: `'bounds'` units mapped onto `box`, and
 * a tile kind swapped for its texture. `null` when a tile cannot rasterize.
 */
export function commandPaint(paint: Paint, box: FillPoseBox): CommandPaint | null {
  return resolveFillPattern(fillInPoseFrame(paint, box));
}

/**
 * `fill` as a draw command's fill, its paint resolved by {@link commandPaint}.
 * `null` when the fill carries no paint, or its paint cannot be resolved.
 */
export function commandFill(fill: Fill, box: FillPoseBox): CommandFill | null {
  if (fill.paint == null) return null;
  const paint = commandPaint(fill.paint, box);
  if (paint === null) return null;
  // Same object when nothing changed, as `commandStroke` keeps it.
  return paint === fill.paint ? (fill as CommandFill) : { ...fill, paint };
}

/**
 * `stroke` as a draw command's stroke, its paint resolved as
 * {@link commandPaint} resolves one. `null` when the stroke carries no
 * paint, or its paint cannot be resolved.
 */
export function commandStroke(stroke: Stroke, box: FillPoseBox): CommandStroke | null {
  if (stroke.paint == null) return null;
  const paint = commandPaint(stroke.paint, box);
  if (paint === null) return null;
  // Same object when nothing changed: the renderer's stroke caches key on it.
  return paint === stroke.paint ? (stroke as CommandStroke) : { ...stroke, paint };
}
