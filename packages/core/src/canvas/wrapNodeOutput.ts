/**
 * The per-node wraps a scene render applies on top of whatever `drawOne`
 * returned — pose rotation, then a per-id alpha multiplier. They sit outside
 * `drawOne` on purpose: consumer-supplied painters get rotation and dimming
 * without having to reimplement either.
 *
 * Shared by the main canvas (`buildSceneLayer`) and the detached renders
 * (`buildSceneViewCommands`) so a scene painted off-screen matches the same
 * scene painted on it.
 */
import type { DrawCommand } from '@weasel-js/renderer';
import { wrapWithPoseRotation } from './poseRotation';
import { overChildren, splitOverChildren } from './overChildren';

/** Rotate `cmds` about the pose's AABB center and multiply by `alpha`.
 *  Both wraps are skipped when they would be no-ops (zero/absent rotation,
 *  alpha exactly 1, empty command list), so an upright opaque node emits the
 *  painter's commands untouched. Alpha nests OUTSIDE rotation. */
export function wrapNodeOutput(
  cmds: DrawCommand[],
  pose: unknown,
  alpha: number,
): DrawCommand[] {
  const { under, over } = splitOverChildren(cmds);
  const wrapped = wrapPart(under, pose, alpha);
  // What a painter asked to draw over the node's children is wrapped apart, so it is still over them.
  return over.length > 0 ? [...wrapped, overChildren(wrapPart(over, pose, alpha))] : wrapped;
}

function wrapPart(cmds: DrawCommand[], pose: unknown, alpha: number): DrawCommand[] {
  const rotated = wrapWithPoseRotation(cmds, pose);
  if (alpha !== 1 && rotated.length > 0) {
    return [{ kind: 'group', alpha, children: rotated }];
  }
  return rotated;
}
