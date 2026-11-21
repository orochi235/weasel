import type { ActionDeps } from '@weasel-js/routing';
import { ActionDisabledReason, defineAction } from '@weasel-js/routing';
import {
  createTransformCommit, defaultCommitAdapter, operandContent, operandMethods, requiresOperands, swappable,
} from '@weasel-js/core';
import { icon } from '../../icons.gen';
import { SWAP_GROUP } from '../../actionGroups';
import { swapOps } from './swapOps';
import { opsAnswer, writesLocked } from '../lockedWrites';

/** The two selected nodes a swap trades, or null unless exactly two are selected and `swappable` lets them. */
function pairOf(deps: ActionDeps): readonly [string, string] | null {
  const scene = deps.scene;
  if (!scene) return null;
  const ids = operandContent(deps);
  if (ids.length !== 2) return null;
  const [a, b] = ids as unknown as [string, string];
  return swappable(scene, a, b, deps) ? [a, b] : null;
}

/**
 * Trades the places of the two selected nodes, as one undo step labeled "Swap": each moves onto the other's
 * bounds and takes its parent and place in the stacking order (`swapOps`). Enabled only for exactly two nodes
 * `swappable` lets trade places, which the `canSwap` dep decides.
 */
export const swapAction = defineAction({
  id: 'swap',
  label: 'Swap',
  group: SWAP_GROUP,
  icon: icon('swap'),
  tags: ['exchange', 'trade places'],
  eligible: { capability: 'transforms-selection' },
  requires: ['operands', 'scene', 'applyOps', 'geometryProjection', 'poseDescriptor', 'canSwap', 'canDropInto', 'transformFollowers'],
  invoker: {
    timing: 'immediate',
    run: (deps) => {
      const selection = deps.operands;
      const scene = deps.scene;
      const pair = pairOf(deps);
      if (!selection || !scene || pair === null) return;
      const ops = swapOps(scene, pair[0], pair[1], deps);
      if (ops === null || ops.length === 0 || writesLocked(scene, ops)) return;
      const applyOps = createTransformCommit(deps);
      if (applyOps) applyOps(ops, 'Swap');
      else scene.applyBatch(ops, 'Swap', defaultCommitAdapter(scene, operandMethods(selection)));
    },
  },
  enabled: (deps) => {
    const needs = requiresOperands(deps);
    if (needs !== true) return needs;
    const pair = pairOf(deps!);
    const ops = pair === null ? null : swapOps(deps!.scene!, pair[0], pair[1], deps!);
    return ops === null ? ActionDisabledReason.NotApplicable : opsAnswer(deps!.scene!, ops);
  },
});
