import { useCallback, useMemo, useSyncExternalStore } from 'react';
import type { PrefPath, PrefValueAt } from './paths';
import type { PrefGroup } from './groups';
import type { PrefScope, PrefSelection } from './scope';
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

/** Everything a `PrefsForm` or `PrefsDialog` takes from a store, under the props' own names. */
export interface PrefsFormBinding<S extends PrefGroup = PrefGroup> {
  schema: S;
  values: Record<string, unknown>;
  onChange: (path: string, value: unknown) => void;
  auto: ReadonlySet<string>;
  onAutoChange: (path: string, next: boolean) => void;
  onReset: (path: string) => void;
  scopes: ReadonlyMap<string, PrefScope>;
  onChangeAt: (path: string, value: unknown, at: PrefSelection) => void;
}

/** The whole of `store` as React state: `values`, `set`, `auto` (the leaves now unpinned) and `setAuto`,
 *  `reset`, which puts a leaf or a group back as its schema says, and `unset` (the leaves nothing is stored
 *  for); for its scoped values, `scopes` and `setAt`. `stored` is `store.stored()`. `form` is all of it under
 *  `PrefsForm`'s prop names, to spread on: `<PrefsForm {...form} />`. */
export function usePrefsValues<S extends PrefGroup>(store: PrefsStore<S>): {
  values: Record<string, unknown>;
  set: (path: string, value: unknown) => void;
  unset: ReadonlySet<string>;
  auto: ReadonlySet<string>;
  stored: Record<string, unknown>;
  reset: (path?: string) => void;
  setAuto: (path: string, next: boolean) => void;
  scopes: ReadonlyMap<string, PrefScope>;
  setAt: (path: string, value: unknown, at: PrefSelection) => void;
  form: PrefsFormBinding<S>;
} {
  const subscribe = useCallback((onChange: () => void) => store.subscribe(onChange), [store]);
  const values = useSyncExternalStore(subscribe, store.values, store.values);
  const unset = useSyncExternalStore(subscribe, store.unset, store.unset);
  const auto = useSyncExternalStore(subscribe, store.auto, store.auto);
  const stored = useSyncExternalStore(subscribe, store.stored, store.stored);
  const scopes = useSyncExternalStore(subscribe, store.scopes, store.scopes);
  const set = useCallback(
    (path: string, value: unknown) => store.set(path as PrefPath<S>, value as never),
    [store],
  );
  const reset = useCallback((path?: string) => store.reset(path), [store]);
  const setAuto = useCallback((path: string, next: boolean) => store.setAuto(path as PrefPath<S>, next), [store]);
  const setAt = useCallback(
    (path: string, value: unknown, at: PrefSelection) => store.set(path as PrefPath<S>, value as never, { at }),
    [store],
  );
  const form = useMemo<PrefsFormBinding<S>>(
    () => ({ schema: store.schema, values, onChange: set, auto, onAutoChange: setAuto, onReset: reset, scopes, onChangeAt: setAt }),
    [store, values, set, auto, setAuto, reset, scopes, setAt],
  );
  return { values, set, unset, auto, stored, reset, setAuto, scopes, setAt, form };
}
