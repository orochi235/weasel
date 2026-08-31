import { createContext, useContext } from 'react';

/** Where an undocked panel's DOM lives. The panel's *content* stays owned by
 *  its trial — it is React-portalled into the host — so a torn-out section
 *  keeps the trial's context, state and subscriptions instead of being rebuilt
 *  as a sibling of the trial it came from. */
export interface PanelHostRegistry {
  set: (key: string, el: HTMLElement | null) => void;
  get: (key: string) => HTMLElement | null;
  subscribe: (fn: () => void) => () => void;
}

export function createPanelHostRegistry(): PanelHostRegistry {
  const hosts = new Map<string, HTMLElement>();
  const listeners = new Set<() => void>();
  const notify = () => {
    for (const fn of listeners) fn();
  };
  return {
    set: (key, el) => {
      if (el) hosts.set(key, el);
      else hosts.delete(key);
      notify();
    },
    get: (key) => hosts.get(key) ?? null,
    subscribe: (fn) => {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
  };
}

export const PanelHostContext = createContext<PanelHostRegistry | null>(null);

export function usePanelHosts(): PanelHostRegistry | null {
  return useContext(PanelHostContext);
}
