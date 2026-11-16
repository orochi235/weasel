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
  const listeners = new Set<() => void>();
  const changed = () => {
    for (const l of [...listeners]) l();
  };
  return {
    all,
    claim: (claim) => {
      all.add(claim);
      changed();
      return () => {
        if (all.delete(claim)) changed();
      };
    },
    subscribe: (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}

/** Whether anything claims `claims` now: its actions are registered only then, so a lab lists no keys nothing answers. */
export function useClaimed<T>(claims: KeyClaims<T>): boolean {
  return useSyncExternalStore(claims.subscribe, () => claims.all.size > 0);
}
