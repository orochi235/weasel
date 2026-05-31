import { type ReactNode, useRef } from 'react';
import { LabStoreProvider, WorkspaceIdProvider } from './context';
import { createLabStore, type LabStore } from './store';
import type { StorageAdapter } from './types';

const SINGLETON_INSTRUMENT = '__singleton__';

export interface SingletonExperimentProviderProps<TS, TC> {
  /** Stable id for the synthetic workspace; also doubles as the
   *  WorkspaceIdContext value. */
  id: string;
  initialConfig: TC;
  initialState: TS;
  storage: StorageAdapter;
  storageKey: string;
  children: ReactNode;
}

/**
 * One-workspace `<Lab>` substitute for single-screen experiments. Mounts
 * a `LabStoreProvider` + `WorkspaceIdProvider` with one synthetic
 * workspace, so `useExperimentState` works without going through the
 * full `<Lab instruments={...}>` runtime.
 */
export function SingletonExperimentProvider<TS, TC>({
  id,
  initialConfig,
  initialState,
  storage,
  storageKey,
  children,
}: SingletonExperimentProviderProps<TS, TC>) {
  const storeRef = useRef<LabStore | null>(null);
  if (storeRef.current === null) {
    const store = createLabStore({ storageKey, storage });
    if (!store.getState().workspaces.some((w) => w.id === id)) {
      store.getState().addWorkspace({
        id,
        instrumentName: SINGLETON_INSTRUMENT,
        config: initialConfig,
        state: initialState,
        view: { zoom: 1, pan: { x: 0, y: 0 } },
      });
    }
    storeRef.current = store;
  }
  return (
    <LabStoreProvider store={storeRef.current}>
      <WorkspaceIdProvider workspaceId={id}>{children}</WorkspaceIdProvider>
    </LabStoreProvider>
  );
}
