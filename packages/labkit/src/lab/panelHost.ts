import { createReflectable, type Reflection } from '@weasel-js/registry';
import { createContext, useContext } from 'react';

/** Where an undocked panel's DOM lives. The panel's *content* stays owned by
 *  its trial — it is React-portalled into the host — so a torn-out section
 *  keeps the trial's context, state and subscriptions instead of being rebuilt
 *  as a sibling of the trial it came from. */
export interface PanelHostRegistry {
  set: (key: string, el: HTMLElement | null) => void;
  get: (key: string) => HTMLElement | null;
  subscribe: (fn: () => void) => () => void;
  /** Each key's host element. */
  readonly reflection: Reflection<HTMLElement>;
}

export function createPanelHostRegistry(): PanelHostRegistry {
  const hosts = createReflectable<HTMLElement>({ name: 'panel hosts' });
  return {
    set: (key, el) => {
      if ((hosts.get(key) ?? null) === el) return;
      if (el) hosts.set(key, el);
      else hosts.delete(key);
    },
    get: (key) => hosts.get(key) ?? null,
    subscribe: hosts.subscribe,
    reflection: hosts.reflection,
  };
}

export const PanelHostContext = createContext<PanelHostRegistry | null>(null);

export function usePanelHosts(): PanelHostRegistry | null {
  return useContext(PanelHostContext);
}
