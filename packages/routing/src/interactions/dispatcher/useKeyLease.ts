import { useEffect } from 'react';
import type { ActionsRegistry } from '../actions/registry';

/** Live canvases per registry, so of two canvases on one registry, the first to leave keeps its keys for the other. */
const canvasesOn = new WeakMap<ActionsRegistry, number>();

/** Count this dispatcher on `actions` while enabled; the last to leave takes the registry out of the key order. */
export function useKeyLease(actions: ActionsRegistry, enabled: boolean): void {
  useEffect(() => {
    if (!enabled) return;
    canvasesOn.set(actions, (canvasesOn.get(actions) ?? 0) + 1);
    return () => {
      const left = (canvasesOn.get(actions) ?? 1) - 1;
      if (left > 0) {
        canvasesOn.set(actions, left);
        return;
      }
      canvasesOn.delete(actions);
      actions.dropKeys();
    };
  }, [actions, enabled]);
}
