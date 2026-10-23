import type { Action } from '@weasel-js/routing';

/**
 * Starts in-place text editing on the single selected node. It has no
 * `defaultBinding`: it fires only via `Tool.bindings`.
 *
 * A `'selected-body'` target matches any selected node kind, so the action
 * skips a node `TextEditDep.isTextNode` rejects. With no `isTextNode` it fires
 * unconditionally, and the binding spec is the only gate; a binding can
 * pre-filter with `target: 'kind:text:selected'` instead.
 */
export const enterTextEditAction: Action & { requires: string[] } = {
  id: 'enterTextEdit',
  label: 'Enter text edit',
  eligible: { mode: 'normal' },
  requires: ['textEdit', 'selection'],
  invoker: {
    timing: 'immediate',
    run: (deps) => {
      const sel = deps.selection?.get() ?? [];
      if (sel.length !== 1) return;

      const id = sel[0];
      const textEdit = deps.textEdit;
      if (!textEdit) return;

      // Self-guard: skip non-text nodes when the predicate is supplied.
      if (textEdit.isTextNode && !textEdit.isTextNode(id)) return;

      textEdit.startEdit(id);
    },
  },
};
