import { useSyncExternalStore } from 'react';
import { actionsNodeOf, useActionsRegistry } from './ActionsProvider';
import type { ActionsRegistry } from './registry';
import type { LastOperation, LastOperationStore } from './lastOperation';

const NO_STORE = (): null => null;
const NO_SUBSCRIBE = (): (() => void) => () => {};

/** The last operation store of the actions tree `registry` belongs to, or `null` for a registry that is not one
 *  of the kit's. */
export function lastOperationOf(registry: ActionsRegistry | null): LastOperationStore | null {
  return actionsNodeOf(registry)?.lastOperation ?? null;
}

/** The last operation store of the actions tree in scope, or `null` outside an `<ActionsProvider>`. */
export function useLastOperationStore(): LastOperationStore | null {
  return lastOperationOf(useActionsRegistry());
}

/** What `store` holds now, rerendering as it changes; `store` defaults to the one in scope. */
export function useLastOperation(store?: LastOperationStore | null): LastOperation | null {
  const inScope = useLastOperationStore();
  const s = store === undefined ? inScope : store;
  return useSyncExternalStore(s?.subscribe ?? NO_SUBSCRIBE, s?.get ?? NO_STORE, s?.get ?? NO_STORE);
}
