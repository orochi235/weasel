import { useEffect, useState, useSyncExternalStore } from 'react';
import { useOptionalDepRegistry } from '../interactions/actions/depRegistry';
import type { KeymapStack, OpenKeymap } from './keymapStack';

const noSubscribe = (): (() => void) => () => {};
const none = (): null => null;

/** The innermost keymap open on the canvas in scope, or `null` while none is.
 *  Re-renders as keymaps open and close. */
export function useInnermostKeymap(): OpenKeymap | null {
  const deps = useOptionalDepRegistry();
  const [stack, setStack] = useState<KeymapStack | undefined>(() => deps?.get('keymaps'));
  // The canvas registers its stack in an effect, after this hook's first render.
  useEffect(() => {
    if (!deps) return;
    const read = () => { setStack(deps.get('keymaps')); };
    read();
    return deps.subscribe?.(read);
  }, [deps]);
  return useSyncExternalStore(stack?.subscribe ?? noSubscribe, stack?.innermost ?? none);
}
