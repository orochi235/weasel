import { useCallback, useSyncExternalStore } from 'react';
import type { PrefPath, PrefValueAt } from './paths';
import type { PrefGroup } from './groups';
import type { PrefLocus, PrefSelection } from './locus';
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
  const getSnapshot = () => store.get(path);
  const value = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
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
 *  `onChange={set}`, `auto={unset}`, and `reset` for `onAutoChange`; for its
 *  split values, `loci`, `onSplit={split}`, `onJoin={join}`, and
 *  `onChangeAt={setAt}`. `stored` is `store.stored()`. */
export function usePrefsValues<S extends PrefGroup>(store: PrefsStore<S>): {
  values: Record<string, unknown>;
  set: (path: string, value: unknown) => void;
  unset: ReadonlySet<string>;
  stored: Record<string, unknown>;
  reset: (path?: string) => void;
  loci: ReadonlyMap<string, PrefLocus>;
  split: (path: string, by: string) => void;
  join: (path: string, by: string) => void;
  setAt: (path: string, value: unknown, at: PrefSelection) => void;
} {
  const subscribe = useCallback((onChange: () => void) => store.subscribe(onChange), [store]);
  const values = useSyncExternalStore(subscribe, store.values, store.values);
  const unset = useSyncExternalStore(subscribe, store.unset, store.unset);
  const stored = useSyncExternalStore(subscribe, store.stored, store.stored);
  const loci = useSyncExternalStore(subscribe, store.loci, store.loci);
  const set = useCallback(
    (path: string, value: unknown) => store.set(path as PrefPath<S>, value as never),
    [store],
  );
  const reset = useCallback((path?: string) => store.reset(path), [store]);
  const split = useCallback((path: string, by: string) => store.split(path as PrefPath<S>, by), [store]);
  const join = useCallback((path: string, by: string) => store.join(path as PrefPath<S>, by), [store]);
  const setAt = useCallback(
    (path: string, value: unknown, at: PrefSelection) => store.set(path as PrefPath<S>, value as never, { at }),
    [store],
  );
  return { values, set, unset, stored, reset, loci, split, join, setAt };
}
