import { useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import { useActionsRegistry } from '../interactions/actions/ActionsProvider';
import { useOptionalDepRegistry } from '../interactions/actions/depRegistry';
import { describeKeymap, type KeymapDescription } from './describeKeymap';
import type { KeymapStack } from './keymapStack';

const noSubscribe = (): (() => void) => () => {};

/** The innermost keymap open on the canvas in scope, described for a hint, or
 *  `null` while none is. Re-renders as keymaps open and close. */
export function useOpenKeymap(): KeymapDescription | null {
  const deps = useOptionalDepRegistry();
  const registry = useActionsRegistry();
  const [stack, setStack] = useState<KeymapStack | undefined>(() => deps?.get('keymaps'));
  // The canvas registers its stack in an effect, after this hook's first render.
  useEffect(() => {
    if (!deps) return;
    const read = () => { setStack(deps.get('keymaps')); };
    read();
    return deps.subscribe?.(read);
  }, [deps]);
  const version = useSyncExternalStore(stack?.subscribe ?? noSubscribe, () => stack?.getVersion() ?? -1);
  return useMemo(() => {
    const open = stack?.innermost();
    if (!open) return null;
    return describeKeymap(open, registry?.list() ?? [], registry?.bindingOverrides());
    // `version` stands for the stack's contents, which `innermost` reads.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stack, version, registry]);
}
