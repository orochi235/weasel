import type { NodeId } from 'core/scene/types';
import type { Action } from '../registry';

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
  requires: ['selection'],
  invoker: {
    timing: 'immediate',
    run: (deps) => {
      const sel = (deps.selection as { get(): NodeId[] } | undefined)?.get() ?? [];
      if (sel.length === 0) return;
      (deps.selection as { set(ids: NodeId[]): void } | undefined)?.set([]);
    },
  },
};
