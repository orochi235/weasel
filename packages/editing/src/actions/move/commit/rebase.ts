import { createSetPoseOp, rebaseLocalPose, type PoseAdapter, type PoseComposition } from '@weasel-js/core/engine';
import type { Op } from '@weasel-js/core';

/** A world-posed transform op as one in its node's stored frame: `from` under
 *  `fromParent`, `to` under `toParent`. Any other op is returned as it is.
 *  `null` when either frame is singular and the op cannot keep its poses. */
export function rebaseTransformOp(
  op: Op,
  adapter: PoseAdapter<unknown>,
  pc: PoseComposition<unknown>,
  fromParent: string | null,
  toParent: string | null,
): Op | null {
  if (op.name !== 'transform') return op;
  const a = op.args as { id: string; from: unknown; to: unknown; label?: string; coalesceKey?: string };
  const from = rebaseLocalPose(adapter, a.from, fromParent, pc.compose, pc.decompose);
  const to = rebaseLocalPose(adapter, a.to, toParent, pc.compose, pc.decompose);
  if (from === null || to === null) return null;
  return createSetPoseOp<unknown>({
    id: a.id,
    from,
    to,
    label: a.label,
    coalesceKey: a.coalesceKey,
  });
}
