import { createContext, createElement, useCallback, useContext, useLayoutEffect, useState, useSyncExternalStore, type ReactNode } from 'react';
import {
  createKitSettingsStore,
  NO_KIT_SETTINGS,
  type KitSettingAt,
  type KitSettingPath,
  type KitSettingsOverrides,
  type KitSettingsStore,
} from './kitSettings';

const KitSettingsContext = createContext<KitSettingsStore>(NO_KIT_SETTINGS);

/**
 * Set kit settings for everything inside. Nested providers merge: a leaf this
 * one leaves unset reads through to the one above.
 */
export function KitSettingsProvider({ value, children }: { value: KitSettingsOverrides; children?: ReactNode }): ReactNode {
  const parent = useContext(KitSettingsContext);
  const [store, setStore] = useState(() => ({ parent, store: createKitSettingsStore(value, parent) }));
  if (store.parent !== parent) setStore({ parent, store: createKitSettingsStore(value, parent) });
  useLayoutEffect(() => {
    store.store.set(value);
  }, [store, value]);
  return createElement(KitSettingsContext.Provider, { value: store.store }, children);
}

/**
 * The store the nearest provider holds, for code outside React — a gesture
 * recognizer, a canvas action — to read with `get(path)` at the moment it
 * needs a value.
 */
export function useKitSettings(): KitSettingsStore {
  return useContext(KitSettingsContext);
}

/**
 * The setting at `path`, or `undefined` where no provider sets it; the caller
 * falls back to its own constant. Re-renders only when this path's value changes.
 */
export function useKitSetting<P extends KitSettingPath>(path: P): KitSettingAt<P> | undefined {
  const store = useKitSettings();
  const read = useCallback(() => store.get(path), [store, path]);
  return useSyncExternalStore(store.subscribe, read, read);
}
