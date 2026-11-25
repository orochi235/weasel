import type { NodeId, Op, Scene } from '@weasel-js/core';
import { writtenBy, commitOps, finishTransformOps } from '@weasel-js/core';
import { ActionDisabledReason, type ActionDeps } from '@weasel-js/routing';

/** Whether committing `ops` would write the pose or data of a locked node, which the scene's lock guard refuses:
 *  an envelope moves, turns, or mirrors by rewriting its sources, and one of them may be locked. */
export function writesLocked(scene: Scene<unknown, string, unknown>, ops: readonly Op[]): boolean {
  if (ops.length === 0 || typeof scene.isLocked !== 'function') return false;
  const written = writtenBy(scene, ops);
  return written !== null && anyLocked(scene, [...written.keys()] as NodeId[]);
}

/** Whether any of `ids` is locked: by its own flag, a group holding it, or its layer. */
export function anyLocked(scene: Pick<Scene<unknown, string, unknown>, 'isLocked'>, ids: readonly NodeId[]): boolean {
  return typeof scene.isLocked === 'function' && ids.some((id) => scene.isLocked(id));
}

/** `enabled`'s answer for a command that would commit `ops` (ruled 2026-11-09 and 2026-11-10): not applicable when
 *  they change nothing, locked when they would rewrite a locked node. */
export function opsAnswer(scene: Scene<unknown, string, unknown>, ops: readonly Op[]): true | ActionDisabledReason {
  if (ops.length === 0) return ActionDisabledReason.NotApplicable;
  return writesLocked(scene, ops) ? ActionDisabledReason.Locked : true;
}

/** `enabled`'s answer for a whole-node transform committing `ops`, asked of the batch the `transformFollowers` dep
 *  finishes, which is what {@link commitTransform} commits: not applicable when the followers refuse it. */
export function transformAnswer(
  deps: ActionDeps, scene: Scene<unknown, string, unknown>, ops: Op[], label: string,
): true | ActionDisabledReason {
  const all = ops.length > 0 ? finishTransformOps(deps, ops, label) : null;
  return all ? opsAnswer(scene, all) : ActionDisabledReason.NotApplicable;
}

/** Commit `ops`, a whole-node transform, as the `transformFollowers` dep finishes it, as one undo entry; nothing when
 *  the followers refuse it or the finished batch would rewrite a locked node. Returns whether anything committed. */
export function commitTransform(
  deps: ActionDeps, scene: Scene<unknown, string, unknown>, ops: Op[], label: string,
): boolean {
  const all = ops.length > 0 ? finishTransformOps(deps, ops, label) : null;
  if (!all || all.length === 0 || writesLocked(scene, all)) return false;
  return commitOps(deps, all, label);
}
