import { createContext, type ReactElement, type ReactNode, useContext, useMemo } from 'react';
import { useStore } from 'zustand/react';
import type { LabStore } from './store';
import type { LabStoreState } from './types';

/** Context carrying the lab store. Prefer `useLabStore`; this is exported for
 *  code that needs to read the context without subscribing. */
export const LabStoreContext = createContext<{ store: LabStore } | null>(null);

/** Provides a lab store to its subtree. */
export function LabStoreProvider({
  store,
  children,
}: {
  store: LabStore;
  children: ReactNode;
}): ReactElement {
  const value = useMemo(() => ({ store }), [store]);
  return <LabStoreContext.Provider value={value}>{children}</LabStoreContext.Provider>;
}

/** Subscribe to the whole lab store. Throws outside a `<LabStoreProvider>`. */
export function useLabStore(): LabStoreState & ReturnType<LabStore['getState']> {
  const ctx = useContext(LabStoreContext);
  if (!ctx) throw new Error('[labkit] useLabStore must be used inside <LabStoreProvider>');
  return useStore(ctx.store);
}

/** Context carrying which trial the subtree belongs to. */
export const TrialIdContext = createContext<string | null>(null);

/** A trial's own writers: the ones its undo and `onConfigChange` hear. */
export interface TrialWriters {
  setState: (next: unknown) => void;
  setConfig: (path: string, value: unknown) => void;
}

/** The writers of the trial around the caller, or `null` where a store and id
 *  are provided without one, as `SingletonExperiment` does. */
export const TrialWritersContext = createContext<TrialWriters | null>(null);

/** Names the trial its subtree belongs to, so an instrument's hooks can
 *  find their own record in the store without being passed an id. `writes`
 *  routes `useTrialState`'s setters through the trial's own. */
export function TrialIdProvider({
  trialId,
  writes = null,
  children,
}: {
  trialId: string;
  writes?: TrialWriters | null;
  children: ReactNode;
}): ReactElement {
  return (
    <TrialIdContext.Provider value={trialId}>
      <TrialWritersContext.Provider value={writes}>{children}</TrialWritersContext.Provider>
    </TrialIdContext.Provider>
  );
}

/** The id of the trial this component is inside. Throws outside a
 *  `<TrialIdProvider>`. */
export function useTrialId(): string {
  const id = useContext(TrialIdContext);
  if (!id) throw new Error('[labkit] useTrialId must be used inside <TrialIdProvider>');
  return id;
}
