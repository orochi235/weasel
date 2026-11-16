import { createEmitter } from '@weasel-js/registry';
import { createContext, useContext, useEffect, useSyncExternalStore } from 'react';
import type { AnnotationsApi } from './types';

/** Every open trial's marks, for chrome that works across trials: the lab's options palette restyles a selection
 *  wherever it was made. */
export interface LabMarkStores {
  /** Each trial's store. The same array until one comes or goes. */
  list(): readonly AnnotationsApi[];
  /** Add a trial's store; returns its removal. Stores registered under one trial id stack, newest live. */
  register(trialId: string, store: AnnotationsApi): () => void;
  /** Fires when a store comes or goes, and on every change any of them reports. */
  subscribe(fn: () => void): () => void;
  /** Counts the notifications `subscribe` has sent. */
  version(): number;
}

/** A registry of trials' mark stores. */
export function createLabMarkStores(): LabMarkStores {
  const stacks = new Map<string, { store: AnnotationsApi; off: () => void }[]>();
  const changed = createEmitter();
  let listed: readonly AnnotationsApi[] = [];
  let version = 0;
  const notify = () => {
    version += 1;
    changed.emit();
  };
  const relist = () => {
    listed = [...stacks.values()].map((stack) => stack.at(-1)!.store);
    notify();
  };
  return {
    list: () => listed,
    register(trialId, store) {
      const entry = { store, off: store.subscribe(notify) };
      const stack = stacks.get(trialId) ?? [];
      stack.push(entry);
      stacks.set(trialId, stack);
      relist();
      let released = false;
      return () => {
        if (released) return;
        released = true;
        entry.off();
        const cur = stacks.get(trialId);
        const i = cur?.lastIndexOf(entry) ?? -1;
        if (!cur || i === -1) return;
        cur.splice(i, 1);
        if (cur.length === 0) stacks.delete(trialId);
        relist();
      };
    },
    subscribe: changed.subscribe,
    version: () => version,
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
