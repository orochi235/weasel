import { createContext, useContext, useState, useSyncExternalStore, type ReactElement, type ReactNode } from 'react';
import { createRecentColorsStore, type RecentColorsStore } from './recentColors';

const RecentColorsContext = createContext<RecentColorsStore | null>(null);

/** Props for {@link RecentColorsProvider}. */
export interface RecentColorsProviderProps {
  /** The store to record into. Default: one {@link createRecentColorsStore}
   *  makes on mount, backed by `localStorage`. */
  store?: RecentColorsStore;
  children?: ReactNode;
}

/**
 * Turns on recent-color recording for the pickers beneath it — `ColorField`,
 * `SwatchGrid`, `FillStrokeSwatch`, and everything built on them, gradient
 * stops included. Outside a provider nothing is recorded.
 */
export function RecentColorsProvider({ store, children }: RecentColorsProviderProps): ReactElement {
  const [fallback] = useState(() => (store ? null : createRecentColorsStore()));
  return (
    <RecentColorsContext.Provider value={store ?? fallback}>{children}</RecentColorsContext.Provider>
  );
}

/** The nearest provider's store, or `null` outside one. */
export function useRecentColorsStore(): RecentColorsStore | null {
  return useContext(RecentColorsContext);
}

const EMPTY: readonly string[] = [];
const getEmpty = (): readonly string[] => EMPTY;
const subscribeNone = (): (() => void) => () => {};

/** The recent colors, most recent first, re-rendering when they change.
 *  Reads `store`, else the nearest provider's; empty with neither. */
export function useRecentColors(store?: RecentColorsStore | null): readonly string[] {
  const ctx = useRecentColorsStore();
  const s = store ?? ctx;
  const get = s ? s.get : getEmpty;
  return useSyncExternalStore(s ? s.subscribe : subscribeNone, get, get);
}

/** Record a color the user applied into the nearest provider's store. A
 *  no-op outside a provider. For a custom picker to join the recents. */
export function useRecordRecentColor(): (colors: string | readonly string[]) => void {
  const store = useRecentColorsStore();
  return (colors) => store?.record(colors);
}
