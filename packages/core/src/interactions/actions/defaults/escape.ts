import type { Action } from '@weasel-js/routing';
import { ActionDisabledReason } from '@weasel-js/routing';

/**
 * @experimental
 * Static descriptor for the `escape` Action. Clears selection.
 */
// No `eligible` field → always eligible. Escape works in every mode; the
// runtime `enabled` thunk handles the path-edit defer-to-exit case.
export const escapeAction: Action & { requires: string[] } = {
  id: 'escape',
  label: 'Escape',
  // Gated to "no tool is engaged" so a mid-drag Escape goes to
  // `cancelGestureAction` (cancels the drag) instead of clearing
  // selection.
  defaultBinding: {
    kind: 'key',
    key: 'Escape',
    phase: [{ channel: '*', phase: 'initial' }],
  },
  requires: ['selection', 'editAnchors'],
  invoker: {
    timing: 'immediate',
    run: (deps) => {
      const sel = deps.selection?.get() ?? [];
      if (sel.length === 0) return;
      deps.selection?.set([]);
    },
  },
  // Defer to `exitPathEditAction` while path-anchor edit mode is active.
  // Otherwise the more-specific phase qualifier on this binding would beat
  // `exitPathEdit`'s bare key spec, swallowing the Escape that should leave
  // edit mode. With this gate, `escape` reports a disabled reason in that
  // case and the dispatcher falls through to `exitPathEdit`.
  // With nothing selected there is nothing to clear, so the press falls
  // through to `tool.resetToDefault` instead of being spent here.
  enabled: (deps) => {
    const editAnchors = deps?.editAnchors;
    if (editAnchors?.editingId) return ActionDisabledReason.NotApplicable;
    const sel = deps?.selection?.get() ?? [];
    if (sel.length === 0) return ActionDisabledReason.NotApplicable;
    return true;
  },
};
