import { createReflectable, type Reflection } from '@weasel-js/registry';
import { createContext, useContext, useEffect, useSyncExternalStore } from 'react';
import type { AnnotationsApi } from './types';

/** Every open trial's marks, for chrome that works across trials: the lab's options palette restyles a selection
 *  wherever it was made. */
export interface LabMarkStores {
  /** Each trial's store. The same array until one comes or goes. */
  list(): readonly AnnotationsApi[];
  /** Add a trial's store; returns its removal. */
  register(trialId: string, store: AnnotationsApi): () => void;
  /** Fires when a store comes or goes, and on every change any of them reports. */
  subscribe(fn: () => void): () => void;
  /** Counts the notifications `subscribe` has sent. */
  version(): number;
  /** Each trial's store, by trial id. */
  readonly reflection: Reflection<AnnotationsApi>;
}

/** A registry of trials' mark stores. */
export function createLabMarkStores(): LabMarkStores {
  const stores = createReflectable<AnnotationsApi>({ name: 'mark stores' });
  /** The live store's subscription, per trial. */
  const listening = new Map<string, () => void>();
  let listed: readonly AnnotationsApi[] = [];
  const relist = () => {
    listed = stores.entries().map((e) => e.value);
  };
  return {
    list: () => listed,
    register(trialId, store) {
      listening.get(trialId)?.();
      listening.set(trialId, store.subscribe(stores.bump));
      stores.batch(() => {
        stores.set(trialId, store);
        relist();
      });
      return () => {
        if (stores.get(trialId) !== store) return;
        listening.get(trialId)?.();
        listening.delete(trialId);
        stores.batch(() => {
          stores.delete(trialId);
          relist();
        });
      };
    },
    subscribe: stores.subscribe,
    version: stores.getVersion,
    reflection: stores.reflection,
  };
}

export const LabMarkStoresContext = createContext<LabMarkStores | null>(null);

/** Put this trial's marks in the lab's registry while it is mounted. Does nothing outside a lab, or with no store. */
export function useRegisterTrialMarks(trialId: string, store: AnnotationsApi | null): void {
  const registry = useContext(LabMarkStoresContext);
  useEffect(
    () => (registry && store ? registry.register(trialId, store) : undefined),
    [registry, trialId, store],
  );
}

const NOTHING = () => () => {};

/** The lab's trials' mark stores, re-rendering the caller on any change to any of them. */
export function useLabMarkStores(): readonly AnnotationsApi[] {
  const registry = useContext(LabMarkStoresContext);
  useSyncExternalStore(
    registry ? registry.subscribe : NOTHING,
    () => registry?.version() ?? 0,
    () => 0,
  );
  return registry?.list() ?? [];
}
