import type { NodeId } from 'core/scene/types';
import type { Action } from '../registry';
import { ActionDisabledReason } from '../registry';
import { deriveDefaultBinding } from './_keyBindingFromGesture';

/** @experimental */
export interface EscapeDeps {
  getSelection: () => NodeId[];
  setSelection: (ids: NodeId[]) => void;
}

/**
 * @experimental
 * Static descriptor for the `escape` Action. Clears selection.
 */
export const escapeAction: Action = {
  id: 'escape',
  label: 'Escape',
  gestureBinding: { kind: 'key', key: 'Escape' },
  invoker: {
    timing: 'immediate',
    run: (deps) => {
      const sel = (deps.selection as { get(): NodeId[] } | undefined)?.get() ?? [];
      if (sel.length === 0) return;
      (deps.selection as { set(ids: NodeId[]): void } | undefined)?.set([]);
    },
  },
};

/**
 * @experimental
 * Factory for the default `escape` Action. Clears selection. No-op when
 * selection is empty.
 *
 * @deprecated Phase 4+: use `escapeAction` directly. This wrapper is a
 * Phase 4–7 transition shim and will be removed in Phase 8.
 */
export function defaultEscapeAction(deps: EscapeDeps): Action {
  // Spread descriptor fields but exclude `invoker` — the legacy run thunk is
  // the dispatch path for Phase 4–7; if invoker were present the dispatcher
  // would bypass run entirely. Task 8 wires up invoker via useStandardActions.
  const { invoker: _invoker, ...descriptorFields } = escapeAction;
  void _invoker;
  return {
    ...descriptorFields,
    defaultBinding: deriveDefaultBinding(escapeAction.gestureBinding),
    run: () => {
      const sel = deps.getSelection();
      if (sel.length === 0) return;
      deps.setSelection([]);
    },
    enabled: () => (deps.getSelection().length > 0 ? true : ActionDisabledReason.SelectionRequired),
  };
}
