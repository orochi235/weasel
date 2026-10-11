/**
 * A node's paint, resolved into what a draw command takes. One place composes
 * the two resolutions so every painter and layer applies both.
 */

import type { CommandFill, CommandStroke, FillStyle, Stroke } from '@weasel-js/paint';
import { fillInPoseFrame, type FillPoseBox } from '../../core/fillInPoseFrame';
import { resolveFillPattern } from './resolveSpec';

/**
 * `fill` as a draw command's fill: `'bounds'` units mapped onto `box`, and a
 * tile spec swapped for its texture. `null` when a spec cannot rasterize.
 */
export function commandFill(fill: FillStyle, box: FillPoseBox): CommandFill | null {
  return resolveFillPattern(fillInPoseFrame(fill, box));
}

/**
 * `stroke` as a draw command's stroke, its paint resolved as
 * {@link commandFill} resolves a fill. `null` when the stroke carries no
 * paint, or its paint cannot be resolved.
 */
export function commandStroke(stroke: Stroke, box: FillPoseBox): CommandStroke | null {
  if (stroke.paint == null) return null;
  const paint = commandFill(stroke.paint, box);
  if (paint === null) return null;
  // Same object when nothing changed: the renderer's stroke caches key on it.
  return paint === stroke.paint ? (stroke as CommandStroke) : { ...stroke, paint };
}
