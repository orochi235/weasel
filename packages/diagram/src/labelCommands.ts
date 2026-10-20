/**
 * The label edit that is not a drag: the Reset label command.
 */
import { ActionDisabledReason, type Action, type InvocationCtx, type Scene } from '@weasel-js/core';
import { commitLabelToScene, type LabelEdit } from './labelDragAction';
import { diagramLabelOf } from './labelTrait';

/** The command that puts the selected edges' dragged labels back where placement puts them. */
export const RESET_LABEL_ACTION_ID = 'diagram.resetLabel';

const NO_MODIFIERS = { alt: false, shift: false, meta: false, ctrl: false };

/** The labels on `selected` edges that a drag has pinned (`dodge: false`), locked ones too:
 *  locking stops dragging, not resetting. */
function draggedLabels(scene: Scene<unknown, string, unknown> | undefined, selected: readonly string[]): LabelEdit[] {
  const ids = new Set(selected);
  const out: LabelEdit[] = [];
  if (scene === undefined || ids.size === 0) return out;
  for (const node of scene.renderOrderNodes()) {
    const deps = node.dependsOn;
    if (!Array.isArray(deps) || deps.length !== 1 || !ids.has(deps[0] as string)) continue;
    if (diagramLabelOf(node)?.dodge === false) out.push({ labelId: node.id, edgeId: deps[0] as string, placement: null });
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
