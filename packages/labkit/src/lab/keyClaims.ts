import { createEmitter } from '@weasel-js/registry';
import { useSyncExternalStore } from 'react';

/** What the parts of a lab claim a set of its key actions with, and the claims standing now. */
export interface KeyClaims<T> {
  readonly all: ReadonlySet<T>;
  /** Stand `claim` until the returned function is called. */
  claim: (claim: T) => () => void;
  subscribe: (listener: () => void) => () => void;
}

export function createKeyClaims<T>(): KeyClaims<T> {
  const all = new Set<T>();
  const changes = createEmitter();
  const changed = () => changes.emit();
  return {
    all,
    claim: (claim) => {
      all.add(claim);
      changed();
      return () => {
        if (all.delete(claim)) changed();
      };
    },
    subscribe: (listener) => changes.subscribe(listener),
  };
}

/** Whether anything claims `claims` now: its actions are registered only then, so a lab lists no keys nothing answers. */
export function useClaimed<T>(claims: KeyClaims<T>): boolean {
  return useSyncExternalStore(claims.subscribe, () => claims.all.size > 0);
}
