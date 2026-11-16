import type { ActionDeps } from '@weasel-js/routing';
import type { Op } from 'core/ops/types';
import type { AnyScene } from 'core/scene/anyScene';
import { commitTransformOps } from '../transformFinish';
import { moveNodesOps } from '../moveNodes';
import { resizeSelectionOps } from '../resize/replay';
import { rotateSelectionOps } from '../rotate/replay';
import { recordTransform, type RepeatableTransform } from './memory';

/** A move, rotate or resize the selection can be given: a {@link RepeatableTransform} other than a duplicate. */
export type SelectionTransform = Exclude<RepeatableTransform, { kind: 'duplicate' }>;

/** The batch applying `t` to `selected`, not yet finished by the transform followers; empty when it changes nothing. */
export function selectionTransformOps(
  deps: ActionDeps, scene: AnyScene, selected: readonly string[], t: SelectionTransform, label: string,
): Op[] {
  switch (t.kind) {
    case 'translate':
      return moveNodesOps(scene, selected, { dx: t.dx, dy: t.dy }, deps, label);
    case 'rotate':
      return rotateSelectionOps(scene, selected, deps, t.angle, t.pivot, label);
    case 'scale':
      return resizeSelectionOps(scene, selected, t.anchor, t.to, deps, label);
  }
}

/**
 * Apply `t` to the selection as one undo entry labeled `label`, finished by
 * the `transformFollowers` dep as a drag's transform is, and record it for
 * Transform Again. An action calling it requires what Transform Again does
 * for that kind: `scene`, `selection`, `applyOps`, `poseDescriptor`,
 * `transformFollowers`, and `geometryProjection` for a move or `view`,
 * `boundsIncludeStroke` and `drawnBoxes` for a rotate or a resize. Returns
 * whether anything changed.
 */
export function transformSelection(deps: ActionDeps, t: SelectionTransform, label: string): boolean {
  const { scene, operands } = deps;
  if (!scene || !operands) return false;
  const selected = [...operands.get()] as string[];
  if (!commitTransformOps(deps, selectionTransformOps(deps, scene, selected, t, label), label)) return false;
  recordTransform(scene, t, selected);
  return true;
}
