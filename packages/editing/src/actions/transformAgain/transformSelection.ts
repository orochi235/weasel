import type { ActionDeps } from '@weasel-js/routing';
import type { Op } from '@weasel-js/core';
import type { AnyScene } from '@weasel-js/core/engine';
import { ActionDisabledReason, type ActionUnavailable } from '@weasel-js/routing';
import { moveNodesOps, recordTransform, type RepeatableTransform } from '@weasel-js/core';
import { resizeSelectionOps } from '../resize/replay';
import { rotateSelectionOps } from '../rotate/replay';
import { commitTransform, transformAnswer } from '../lockedWrites';

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

/** `enabled`'s answer for applying `t` to the selection (ruled 2026-11-09 and 2026-11-10): not applicable when the
 *  batch the followers finish changes nothing, locked when it would rewrite a locked node. */
export function selectionTransformAnswer(deps: ActionDeps, t: SelectionTransform, label: string): true | ActionUnavailable {
  const { scene, operands } = deps;
  if (!scene || !operands) return ActionDisabledReason.NotApplicable;
  return transformAnswer(deps, scene, selectionTransformOps(deps, scene, [...operands.get()] as string[], t, label), label);
}

/**
 * Apply `t` to the selection as one undo entry labeled `label`, finished by
 * the `transformFollowers` dep as a drag's transform is, and record it for
 * Transform Again. An action calling it requires what Transform Again does
 * for that kind: `scene`, `operands`, `applyOps`, `poseDescriptor`,
 * `transformFollowers`, and `geometryProjection` for a move or `view`,
 * `boundsIncludeStroke` and `drawnBoxes` for a rotate or a resize. Returns
 * whether anything changed.
 */
export function transformSelection(deps: ActionDeps, t: SelectionTransform, label: string): boolean {
  const { scene, operands } = deps;
  if (!scene || !operands) return false;
  const selected = [...operands.get()] as string[];
  const ops = selectionTransformOps(deps, scene, selected, t, label);
  if (!commitTransform(deps, scene, ops, label)) return false;
  recordTransform(scene, t, selected);
  return true;
}
