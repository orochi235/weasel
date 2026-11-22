import type { DragSample } from '@weasel-js/routing';
import { resolveParams } from '@weasel-js/routing';
import { defaultCommitAdapter, operandMethods } from '@weasel-js/core/engine';
import { commitRunOps, readRunLifecycle, reduceBehaviorEnd, runBehaviorCancel } from '@weasel-js/core';
import { clearedSelection, restoreSelection, type InsertFrame, type InsertSession } from './session';
import { insertShape, isCommittableExtent } from './shape';
import * as ops from '@weasel-js/core/ops';

/** Cancel the insert: tell the behaviors, and put the selection the draw
 *  cleared back. */
export function cancelInsert(
  session: Pick<InsertSession, 'behaviors' | 'gestureCtx' | 'priorSelection' | 'selection'>,
): void {
  runBehaviorCancel(session.behaviors, session.gestureCtx);
  restoreSelection(session);
}

/** Commit the insert. Returns whether it committed: a behavior's ops reached
 *  the scene, or the `insert` dep minted a node. `points` is the pointer
 *  trail as the release left it. */
export function commitInsert(
  session: InsertSession,
  frame: Pick<InsertFrame, 'shaped' | 'altHeld'>,
  points: ReadonlyArray<DragSample> | null,
  userRotation: number,
): boolean {
  // Resolve params at commit time so thunked params (polygon
  // `sides` adjusted mid-drag, etc.) see the latest tool state.
  const resolved = resolveParams(session.opts?.params);

  if (session.behaviors.length > 0) {
    const r = reduceBehaviorEnd(session.behaviors, session.gestureCtx);
    if (r === null) return false;
    if (r !== undefined) {
      if (!session.scene) return false;
      return commitRunOps(
        {
          scene: session.scene,
          applyOps: session.applyOps,
          adapter: defaultCommitAdapter(session.scene, operandMethods(session.selection)),
        },
        readRunLifecycle(resolved, 'Insert', session.behaviors),
        r.length > 0 ? [...selectionOps(session), ...r] : r,
      );
    }
  }

  const { bounds, extras, ends } = insertShape(resolved, frame, points, userRotation, session.snap.landingAt, session.place.site);
  // Sub-threshold drag — no insert.
  if (!isCommittableExtent(bounds, extras)) return false;

  const id = session.dep.commit(bounds, extras, ends, clearedSelection(session.priorSelection));
  return id !== null;
}

/** The press's selection clear, as ops for a behavior's batch. */
function selectionOps(session: Pick<InsertSession, 'priorSelection'>) {
  const prior = session.priorSelection;
  return prior.length > 0 ? [ops.setSelection({ from: prior, to: [], label: 'Insert' })] : [];
}
