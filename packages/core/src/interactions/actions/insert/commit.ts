import type { DragSample } from '@weasel-js/routing';
import { resolveParams } from '@weasel-js/routing';
import { defaultCommitAdapter } from '../defaultCommitAdapter';
import { commitGestureOps, readGestureLifecycle, reduceBehaviorEnd, runBehaviorCancel } from '../gestureLifecycle';
import { clearedSelection, type InsertFrame, type InsertSession } from './session';
import { createSetSelectionOp } from 'core/ops/select';
import { insertShape, isCommittableExtent } from './shape';

/** Put back the selection the press cleared, for a draw that ends without
 *  committing. */
export function restoreSelection(session: Pick<InsertSession, 'priorSelection' | 'selection'>): void {
  if (session.priorSelection.length > 0) session.selection?.set([...session.priorSelection]);
}

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
      return commitGestureOps(
        {
          scene: session.scene,
          applyOps: session.applyOps,
          adapter: defaultCommitAdapter(session.scene, session.selection?.adapterMethods),
        },
        readGestureLifecycle(resolved, 'Insert', session.behaviors),
        r.length > 0 ? [...r, ...selectionOps(session)] : r,
      );
    }
  }

  const { bounds, extras, ends } = insertShape(resolved, frame, points, userRotation, session.snap.landingAt);
  // Sub-threshold drag — no insert.
  if (!isCommittableExtent(bounds, extras.kind)) return false;

  const id = session.dep.commit(bounds, extras, ends, clearedSelection(session.priorSelection));
  return id !== null;
}

/** The press's selection clear, as ops for a behavior's batch. */
function selectionOps(session: Pick<InsertSession, 'priorSelection'>) {
  const prior = session.priorSelection;
  return prior.length > 0 ? [createSetSelectionOp({ from: prior, to: [], label: 'Insert' })] : [];
}
