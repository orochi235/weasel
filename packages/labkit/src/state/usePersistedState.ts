import {
  type Dispatch,
  type SetStateAction,
  useCallback,
  useContext,
  useState,
  useSyncExternalStore,
} from 'react';
import { TrialIdContext } from './context';
import { valueRecord } from './labRecords';
import { PersistenceContext } from './Persistence';

/** Options for `usePersistedState`. */
export interface PersistedStateOptions {
  /** `'trial'` — the default inside a trial — keeps a value per trial, and
   *  closing the trial deletes it. `'lab'` shares one value across the lab. */
  scope?: 'trial' | 'lab';
}

/**
 * `useState` whose value survives a reload: a widget's open tab, a panel's
 * position. Inside a `<Lab>`, `SingletonExperimentProvider` or `<Persistence>`
 * the value is a record, loaded before first render and re-rendered when
 * another tab changes it. With no provider above it, or a null `name`, it is
 * plain `useState` — so a component can offer optional persistence and still
 * mount anywhere.
 *
 * Values must be structured-clone values; the JSON-backed adapters warn about
 * one JSON would change. Snapshots do not include them.
 */
export function usePersistedState<T>(
  name: string | null | undefined,
  initial: T | (() => T),
  options: PersistedStateOptions = {},
): [T, Dispatch<SetStateAction<T>>] {
  const records = useContext(PersistenceContext);
  const trialId = useContext(TrialIdContext);
  const [local, setLocal] = useState(initial);

  const record =
    records && name != null ? valueRecord(options.scope === 'lab' ? null : trialId, name) : null;

  const subscribe = useCallback(
    (notify: () => void) =>
      records && record
        ? records.subscribe((changes) => {
            if (changes.some((c) => c.name === record)) notify();
          })
        : () => {},
    [records, record],
  );
  const read = (): T =>
    records && record && records.has(record) ? (records.get(record) as T) : local;
  const persisted = useSyncExternalStore(subscribe, read, read);

  const setPersisted = useCallback<Dispatch<SetStateAction<T>>>(
    (next) => {
      if (!records || !record) return;
      const prev = records.has(record) ? (records.get(record) as T) : local;
      records.set(record, typeof next === 'function' ? (next as (p: T) => T)(prev) : next);
    },
    [records, record, local],
  );

  return records && record ? [persisted, setPersisted] : [local, setLocal];
}
