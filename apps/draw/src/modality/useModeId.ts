import { useCallback, useSyncExternalStore } from 'react';
import type { ModeMachine } from './machine';

/** The id of the mode the machine is in, re-rendering when it changes. */
export function useModeId(machine: ModeMachine): string {
  const { registry } = machine;
  const subscribe = useCallback((fn: () => void) => registry.subscribe(fn), [registry]);
  const read = useCallback(() => registry.current().id, [registry]);
  return useSyncExternalStore(subscribe, read, read);
}
