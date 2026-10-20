/**
 * The label edit that is not a drag: the Reset label command.
 */
import { ActionDisabledReason, type Action, type InvocationCtx, type Scene } from '@weasel-js/core';
import { commitLabelToScene, type LabelEdit } from './labelDragAction';
import { editableLabels } from './labelDragLayer';

/** The command that puts the selected edges' dragged labels back where placement puts them. */
export const RESET_LABEL_ACTION_ID = 'diagram.resetLabel';

const NO_MODIFIERS = { alt: false, shift: false, meta: false, ctrl: false };

/** The labels on `selected` edges that a drag has pinned (`dodge: false`) and an edit may touch. */
function draggedLabels(scene: Scene<unknown, string, unknown> | undefined, selected: readonly string[]): LabelEdit[] {
  if (scene === undefined || selected.length === 0) return [];
  const out: LabelEdit[] = [];
  for (const { labelId, edgeId, label } of editableLabels(scene, new Set(selected))) {
    if (label.dodge === false) out.push({ labelId, edgeId, placement: null });
  }
  return out;
}

/** The `diagram.resetLabel` command: sets each selected edge's dragged label
 *  back to `LABEL_PLACEMENT`, in one history entry when they commit to the scene. */
export function createResetLabelAction(opts: {
  selected: () => readonly string[];
  commit?: (edit: LabelEdit, ctx: InvocationCtx) => void;
}): Action {
  const { commit = commitLabelToScene } = opts;
  return {
    id: RESET_LABEL_ACTION_ID,
    label: 'Reset label',
    group: 'diagram',
    requires: ['scene'],
    invoker: {
      timing: 'immediate',
      run(deps) {
        const edits = draggedLabels(deps.scene as never, opts.selected());
        const ctx = { world: { x: 0, y: 0 }, modifiers: NO_MODIFIERS, deps } as InvocationCtx;
        const all = () => { for (const edit of edits) commit(edit, ctx); };
        if (deps.scene === undefined) all();
        else deps.scene.batch('Reset label', all);
      },
    },
    enabled: (deps) =>
      draggedLabels(deps?.scene as never, opts.selected()).length > 0 ? true : ActionDisabledReason.NotApplicable,
  };
}
