import { createContext, type ReactElement, type ReactNode, useContext } from 'react';
import { useStore } from 'zustand/react';
import type { LabStore } from './store';
import type { LabStoreState } from './types';

type LabStoreCtx = { store: LabStore } | null;

/** Context carrying the lab store. Prefer `useLabStore`; this is exported for
 *  code that needs to read the context without subscribing. */
export const LabStoreContext = createContext<LabStoreCtx>(null);

/** Provides a lab store to its subtree. */
export function LabStoreProvider({
  store,
  children,
}: {
  store: LabStore;
  children: ReactNode;
}): ReactElement {
  return <LabStoreContext.Provider value={{ store }}>{children}</LabStoreContext.Provider>;
}

/** Subscribe to the whole lab store. Throws outside a `<LabStoreProvider>`. */
export function useLabStore(): LabStoreState & ReturnType<LabStore['getState']> {
  const ctx = useContext(LabStoreContext);
  if (!ctx) throw new Error('[labkit] useLabStore must be used inside <LabStoreProvider>');
  return useStore(ctx.store);
}

/** Context carrying which trial the subtree belongs to. */
export const TrialIdContext = createContext<string | null>(null);

/** Names the trial its subtree belongs to, so an instrument's hooks can
 *  find their own record in the store without being passed an id. */
export function TrialIdProvider({
  trialId,
  children,
}: {
  trialId: string;
  children: ReactNode;
}): ReactElement {
  return <TrialIdContext.Provider value={trialId}>{children}</TrialIdContext.Provider>;
}

/** The id of the trial this component is inside. Throws outside a
 *  `<TrialIdProvider>`. */
export function useTrialId(): string {
  const id = useContext(TrialIdContext);
  if (!id) throw new Error('[labkit] useTrialId must be used inside <TrialIdProvider>');
  return id;
}
