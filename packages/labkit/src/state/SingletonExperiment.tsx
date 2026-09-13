import type { ReactNode } from 'react';
import { defaultStorage } from './adapters';
import { LabStoreProvider, TrialIdProvider } from './context';
import { openLabStore } from './openLabStore';
import { PersistenceContext } from './Persistence';
import type { StorageAdapter } from './types';
import { useOpenOnce, useWarnIgnoredChange } from './useOpenOnce';

const SINGLETON_INSTRUMENT = '__singleton__';

/** Props for `<SingletonExperimentProvider>`. */
export interface SingletonExperimentProviderProps<TS, TC> {
  /** Stable id for the synthetic trial; also doubles as the
   *  TrialIdContext value. */
  id: string;
  initialConfig: TC;
  initialState: TS;
  storageKey: string;
  /** Default: IndexedDB, or localStorage where IndexedDB will not open. */
  storage?: StorageAdapter;
  /** Rendered until the stored experiment has loaded. Default: nothing. */
  fallback?: ReactNode;
  children: ReactNode;
}

/**
 * One-trial `<Lab>` substitute for single-screen experiments. Mounts
 * a `LabStoreProvider` + `TrialIdProvider` with one synthetic
 * trial, so `useTrialState` works without going through the
 * full `<Lab instruments={...}>` runtime. `storageKey` and `storage` are read
 * once, at mount.
 */
export function SingletonExperimentProvider<TS, TC>({
  id,
  initialConfig,
  initialState,
  storage,
  storageKey,
  fallback = null,
  children,
}: SingletonExperimentProviderProps<TS, TC>) {
  useWarnIgnoredChange('<SingletonExperimentProvider>', { storageKey, storage });
  const opened = useOpenOnce(async () => {
    const lab = await openLabStore({ storageKey, storage: storage ?? (await defaultStorage()) });
    if (!lab.store.getState().trials.some((w) => w.id === id)) {
      lab.store.getState().addTrial({
        id,
        instrumentName: SINGLETON_INSTRUMENT,
        config: initialConfig,
        state: initialState,
        view: { zoom: 1, pan: { x: 0, y: 0 } },
      });
    }
    return lab;
  });
  if (!opened) return <>{fallback}</>;
  return (
    <LabStoreProvider store={opened.store}>
      <PersistenceContext.Provider value={opened.records}>
        <TrialIdProvider trialId={id}>{children}</TrialIdProvider>
      </PersistenceContext.Provider>
    </LabStoreProvider>
  );
}
