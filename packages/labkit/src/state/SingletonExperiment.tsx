import { type ReactNode, useRef } from 'react';
import { LabStoreProvider, TrialIdProvider } from './context';
import { createLabStore, type LabStore } from './store';
import type { StorageAdapter } from './types';

const SINGLETON_INSTRUMENT = '__singleton__';

/** Props for `<SingletonExperimentProvider>`. */
export interface SingletonExperimentProviderProps<TS, TC> {
  /** Stable id for the synthetic trial; also doubles as the
   *  TrialIdContext value. */
  id: string;
  initialConfig: TC;
  initialState: TS;
  storage: StorageAdapter;
  storageKey: string;
  children: ReactNode;
}

/**
 * One-trial `<Lab>` substitute for single-screen experiments. Mounts
 * a `LabStoreProvider` + `TrialIdProvider` with one synthetic
 * trial, so `useTrialState` works without going through the
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
    if (!store.getState().trials.some((w) => w.id === id)) {
      store.getState().addTrial({
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
      <TrialIdProvider trialId={id}>{children}</TrialIdProvider>
    </LabStoreProvider>
  );
}
