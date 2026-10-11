import { createTransformOp } from 'core/ops/transform';
import type { Op } from 'core/ops/types';
import { rebaseLocalPose, type PoseAdapter, type PoseComposition } from 'features/groups/composePose';

/** A world-posed transform op as one in its node's stored frame: `from` under
 *  `fromParent`, `to` under `toParent`. Any other op is returned as it is. */
export function rebaseTransformOp(
  op: Op,
  adapter: PoseAdapter<unknown>,
  pc: PoseComposition<unknown>,
  fromParent: string | null,
  toParent: string | null,
): Op {
  if (op.name !== 'transform') return op;
  const a = op.args as { id: string; from: unknown; to: unknown; label?: string; coalesceKey?: string };
  return createTransformOp<unknown>({
    id: a.id,
    from: rebaseLocalPose(adapter, a.from, fromParent, pc.compose, pc.decompose),
    to: rebaseLocalPose(adapter, a.to, toParent, pc.compose, pc.decompose),
    label: a.label,
    coalesceKey: a.coalesceKey,
  });
}
