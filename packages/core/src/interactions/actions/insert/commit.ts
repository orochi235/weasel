import type { DragSample } from '@weasel-js/routing';
import { resolveParams } from '@weasel-js/routing';
import { defaultCommitAdapter } from '../defaultCommitAdapter';
import { commitGestureOps, readGestureLifecycle, reduceBehaviorEnd, runBehaviorCancel } from '../gestureLifecycle';
import type { InsertFrame, InsertSession } from './session';
import { insertShape, isCommittableExtent } from './shape';
import { shapeKindInfo } from 'core/shapeKinds';
import type { TextEditDep } from '../depSchema';

/**
 * A freshly inserted text box is empty, so it draws nothing and the tool's own
 * `click on selected body → enterTextEdit` binding has nothing visible to
 * click. Drop straight into the caret instead, for every kind that is text —
 * which is also what every other editor does. `textEdit` is optional: without
 * it the node is still committed.
 */
export function enterInsertedText(textEdit: TextEditDep | undefined, id: string | null, kind: string): void {
  if (id !== null && shapeKindInfo(kind)?.text) textEdit?.startEdit(id, { caret: 0 });
}

/** Cancel the insert: tell the behaviors, and put the selection the draw
 *  cleared back. */
export function cancelInsert(
  session: Pick<InsertSession, 'behaviors' | 'gestureCtx' | 'priorSelection' | 'selection'>,
): void {
  runBehaviorCancel(session.behaviors, session.gestureCtx);
  if (session.priorSelection.length > 0) session.selection?.set([...session.priorSelection]);
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
        r,
      );
    }
  }

  const { bounds, extras, ends } = insertShape(resolved, frame, points, userRotation);
  // Sub-threshold drag — no insert.
  if (!isCommittableExtent(bounds, extras.kind)) return false;

  const id = session.dep.commit(bounds, extras, ends);
  enterInsertedText(session.textEdit, id === null ? null : String(id), extras.kind);
  return id !== null;
}
