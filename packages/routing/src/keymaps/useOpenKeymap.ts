import { useMemo, useSyncExternalStore } from 'react';
import { useActionsRegistry } from '../interactions/actions/ActionsProvider';
import { describeKeymap, type KeymapDescription } from './describeKeymap';
import { useInnermostKeymap } from './useInnermostKeymap';

const noSubscribe = () => () => {};

/** The innermost keymap open on the canvas in scope, described for a hint, or
 *  `null` while none is. Re-renders as keymaps open and close, and as the
 *  actions and binding overrides it names change. */
export function useOpenKeymap(): KeymapDescription | null {
  const registry = useActionsRegistry();
  const open = useInnermostKeymap();
  // Both are cached on the registry's version, so they keep their identity until it moves.
  const actions = useSyncExternalStore(registry ? registry.subscribe : noSubscribe, () => registry?.list());
  const overrides = useSyncExternalStore(registry ? registry.subscribe : noSubscribe, () => registry?.bindingOverrides());
  return useMemo(
    () => (open ? describeKeymap(open, actions ?? [], overrides) : null),
    [open, actions, overrides],
  );
}
