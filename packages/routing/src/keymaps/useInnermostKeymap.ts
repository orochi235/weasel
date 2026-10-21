import { useCallback, useSyncExternalStore } from 'react';
import { useOptionalDepRegistry } from '../interactions/actions/depRegistry';
import type { OpenKeymap } from './keymapStack';

/** The innermost keymap open on the canvas in scope, or `null` while none is.
 *  Re-renders as keymaps open and close, and nothing else: it holds no state of
 *  its own, so a dep registered beside the stack commits nothing. */
export function useInnermostKeymap(): OpenKeymap | null {
  const deps = useOptionalDepRegistry();
  // The canvas registers its stack in an effect, after this hook's first render,
  // so the stack is looked up afresh and followed whenever the deps change.
  const subscribe = useCallback((notify: () => void) => {
    if (!deps) return () => {};
    let leaveStack = deps.get('keymaps')?.subscribe(notify);
    const leaveDeps = deps.subscribe?.(() => {
      leaveStack?.();
      leaveStack = deps.get('keymaps')?.subscribe(notify);
      notify();
    });
    return () => { leaveStack?.(); leaveDeps?.(); };
  }, [deps]);
  return useSyncExternalStore(subscribe, () => deps?.get('keymaps')?.innermost() ?? null);
}
