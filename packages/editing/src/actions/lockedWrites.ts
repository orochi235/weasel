import type { NodeId, Op, Scene } from '@weasel-js/core';
import { writtenBy } from '@weasel-js/core';
import { ActionDisabledReason } from '@weasel-js/routing';

/** Whether committing `ops` would write the pose or data of a locked node, which the scene's lock guard refuses:
 *  an envelope moves, turns, or mirrors by rewriting its sources, and one of them may be locked. */
export function writesLocked(scene: Scene<unknown, string, unknown>, ops: readonly Op[]): boolean {
  if (ops.length === 0 || typeof scene.isLocked !== 'function') return false;
  const written = writtenBy(scene, ops);
  return written !== null && [...written.keys()].some((id) => scene.isLocked(id as NodeId));
}

/** `enabled`'s answer for a command that would commit `ops` (ruled 2026-11-09 and 2026-11-10): not applicable when
 *  they change nothing, locked when they would rewrite a locked node. */
export function opsAnswer(scene: Scene<unknown, string, unknown>, ops: readonly Op[]): true | ActionDisabledReason {
  if (ops.length === 0) return ActionDisabledReason.NotApplicable;
  return writesLocked(scene, ops) ? ActionDisabledReason.Locked : true;
}
