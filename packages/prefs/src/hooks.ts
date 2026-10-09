import { useCallback, useSyncExternalStore } from 'react';
import type { PrefPath, PrefValueAt } from './paths';
import type { PrefGroup } from './schema';
import type { PrefsStore } from './store';

/** One leaf of `store`, as React state. */
export function usePref<S extends PrefGroup, P extends PrefPath<S>>(
  store: PrefsStore<S>,
  path: P,
): [
  PrefValueAt<S, P>,
  (next: PrefValueAt<S, P> | ((prev: PrefValueAt<S, P>) => PrefValueAt<S, P>)) => void,
] {
  const subscribe = useCallback((onChange: () => void) => store.subscribe(onChange), [store]);
  const value = useSyncExternalStore(subscribe, () => store.get(path));
  const set = useCallback(
    (next: PrefValueAt<S, P> | ((prev: PrefValueAt<S, P>) => PrefValueAt<S, P>)) => {
      store.set(
        path,
        typeof next === 'function'
          ? (next as (prev: PrefValueAt<S, P>) => PrefValueAt<S, P>)(store.get(path))
          : next,
      );
    },
    [store, path],
  );
  return [value, set];
}

/** The whole of `store` as React state, shaped for `PrefsForm`: `values`,
 *  `onChange={set}`, `auto={unset}`, and `reset` for `onAutoChange`. */
export function usePrefsValues<S extends PrefGroup>(store: PrefsStore<S>): {
  values: Record<string, unknown>;
  set: (path: string, value: unknown) => void;
  unset: ReadonlySet<string>;
  reset: (path?: string) => void;
} {
  const subscribe = useCallback((onChange: () => void) => store.subscribe(onChange), [store]);
  const values = useSyncExternalStore(subscribe, store.values);
  const unset = useSyncExternalStore(subscribe, store.unset);
  const set = useCallback(
    (path: string, value: unknown) => store.set(path as PrefPath<S>, value as never),
    [store],
  );
  const reset = useCallback((path?: string) => store.reset(path), [store]);
  return { values, set, unset, reset };
}
