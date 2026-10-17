import { useEffect, useSyncExternalStore } from 'react';
import type { IconEntry, IconVariantState } from '@weasel-js/icons';
import { useIconRegistry } from './IconRegistryProvider';

const NONE: readonly IconEntry[] = [];
const NOOP = () => () => {};

/** Every icon registered once `name` has loaded, asking for it on mount or once its loader arrives. A name with no loader lists what is registered. */
export function useIconVariant(name: string): { entries: readonly IconEntry[]; state: IconVariantState } {
  const registry = useIconRegistry();
  const subscribe = registry ? registry.subscribe : NOOP;
  const state = useSyncExternalStore(subscribe, () => registry?.variantState(name) ?? 'unknown');
  const entries = useSyncExternalStore(subscribe, () => registry?.entries() ?? NONE);
  const idle = state === 'idle';
  useEffect(() => {
    if (registry && (idle || state === 'failed')) void registry.loadVariant(name);
    // Asks on mount, and when a loader arrives later. A failure is retried by the next mount, not by a render loop.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [registry, name, idle]);
  return { entries, state };
}
