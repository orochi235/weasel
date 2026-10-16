import { useEffect, useSyncExternalStore } from 'react';
import type { IconEntry, IconVariantState } from '@weasel-js/icons';
import { useIconRegistry } from './IconRegistryProvider';

const NONE: readonly IconEntry[] = [];
const NOOP = () => () => {};

/** Every icon registered once `name` has loaded, asking for it on mount. A name with no loader lists what is registered. */
export function useIconVariant(name: string): { entries: readonly IconEntry[]; state: IconVariantState } {
  const registry = useIconRegistry();
  const subscribe = registry ? registry.subscribe : NOOP;
  const state = useSyncExternalStore(subscribe, () => registry?.variantState(name) ?? 'unknown');
  const entries = useSyncExternalStore(subscribe, () => registry?.entries() ?? NONE);
  useEffect(() => {
    if (registry && (state === 'idle' || state === 'failed')) void registry.loadVariant(name);
    // Ask once per mount; a failure is retried by the next mount, not by a render loop.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [registry, name]);
  return { entries, state };
}
