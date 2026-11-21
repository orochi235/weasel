import type { Action } from '@weasel-js/routing';

/**
 * Starts in-place text editing on the single selected node. It has no
 * `defaultBinding`: it fires only via `Tool.bindings`.
 *
 * A `'selected-body'` target matches any selected node kind, so the action
 * passes the gesture on (`'pass'`) for a node `TextEditDep.isTextNode` rejects,
 * and for a selection of other than one node, letting the next binding (a
 * sticky tool's `place`) take the click. With no `isTextNode` it opens any one
 * selected node; a binding can pre-filter with `target: 'kind:text:selected'`.
 */
export const enterTextEditAction: Action & { requires: string[] } = {
  id: 'enterTextEdit',
  label: 'Enter text edit',
  eligible: { mode: 'normal' },
  requires: ['textEdit', 'operands'],
  invoker: {
    timing: 'immediate',
    run: (deps) => {
      const sel = deps.operands?.get() ?? [];
      if (sel.length !== 1) return 'pass';

      const id = sel[0];
      const textEdit = deps.textEdit;
      if (!textEdit) return 'pass';

      if (textEdit.isTextNode && !textEdit.isTextNode(id)) return 'pass';

      textEdit.startEdit(id);
      return undefined;
    },
  },
};
