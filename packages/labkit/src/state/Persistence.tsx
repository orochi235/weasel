import { createContext, type ReactNode } from 'react';
import { defaultStorage } from './adapters';
import { labPrefix } from './labRecords';
import { openRecords, type RecordCache } from './records';
import type { StorageAdapter } from './types';
import { useOpenOnce, useWarnIgnoredChange } from './useOpenOnce';

/** The records `usePersistedState` reads and writes. `<Lab>`,
 *  `SingletonExperimentProvider` and `<Persistence>` provide one. */
export const PersistenceContext = createContext<RecordCache | null>(null);

/** Props for `<Persistence>`. */
export interface PersistenceProps {
  /** Names the records, as `<Lab storageKey>` does. A lab and a
   *  `<Persistence>` given the same key share lab-scoped values. */
  storageKey: string;
  /** Default: IndexedDB, or localStorage where IndexedDB will not open. */
  storage?: StorageAdapter;
  /** Rendered until the records have loaded. Default: nothing. */
  fallback?: ReactNode;
  children: ReactNode;
}

/** Persisted values for a page with no lab: `usePersistedState` below it keeps
 *  what it holds across a reload. Both props are read once, at mount. */
export function Persistence({ storageKey, storage, fallback = null, children }: PersistenceProps) {
  useWarnIgnoredChange('<Persistence>', { storageKey, storage });
  const records = useOpenOnce(async () =>
    openRecords({ storage: storage ?? (await defaultStorage()), prefix: labPrefix(storageKey) }),
  );
  if (!records) return <>{fallback}</>;
  return <PersistenceContext.Provider value={records}>{children}</PersistenceContext.Provider>;
}
