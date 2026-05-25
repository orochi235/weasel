import type { NodeId } from 'core/scene/types';
import type { Action } from '../registry';
import { ActionDisabledReason } from '../registry';
import type { EditAnchorsDep } from '../depSchema';

/**
 * @experimental
 * Static descriptor for the `escape` Action. Clears selection.
 */
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
      const sel = (deps.selection as { get(): NodeId[] } | undefined)?.get() ?? [];
      if (sel.length === 0) return;
      (deps.selection as { set(ids: NodeId[]): void } | undefined)?.set([]);
    },
  },
  // Defer to `exitPathEditAction` while path-anchor edit mode is active.
  // Otherwise the more-specific phase qualifier on this binding would beat
  // `exitPathEdit`'s bare key spec, swallowing the Escape that should leave
  // edit mode. With this gate, `escape` reports a disabled reason in that
  // case and the dispatcher falls through to `exitPathEdit`.
  enabled: (deps) => {
    const editAnchors = deps?.editAnchors as EditAnchorsDep | undefined;
    if (editAnchors?.editingId) return ActionDisabledReason.NotApplicable;
    return true;
  },
};
