import type { NodeId } from 'core/scene/types';
import type { Action } from '../registry';
import { ActionDisabledReason } from '../registry';

/** @experimental */
export interface EscapeDeps {
  getSelection: () => NodeId[];
  setSelection: (ids: NodeId[]) => void;
}

/**
 * @experimental
 * Factory for the default `escape` Action. Clears selection. No-op when
 * selection is empty.
 */
export function defaultEscapeAction(deps: EscapeDeps): Action {
  return {
    id: 'escape',
    label: 'Escape',
    defaultBinding: { key: 'Escape' },
    gestureBinding: { kind: 'key', key: 'Escape' },
    run: () => {
      const sel = deps.getSelection();
      if (sel.length === 0) return;
      deps.setSelection([]);
    },
    enabled: () => (deps.getSelection().length > 0 ? true : ActionDisabledReason.SelectionRequired),
  };
}
