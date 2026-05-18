import type { NodeId } from 'core/scene/types';
import type { Action } from '../registry';

/**
 * @experimental
 * Static descriptor for the `escape` Action. Clears selection.
 */
export const escapeAction: Action = {
  id: 'escape',
  label: 'Escape',
  defaultBinding: { kind: 'key', key: 'Escape' },
  invoker: {
    timing: 'immediate',
    run: (deps) => {
      const sel = (deps.selection as { get(): NodeId[] } | undefined)?.get() ?? [];
      if (sel.length === 0) return;
      (deps.selection as { set(ids: NodeId[]): void } | undefined)?.set([]);
    },
  },
};
