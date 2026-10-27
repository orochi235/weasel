import { createContext, type RefObject, useContext, useLayoutEffect } from 'react';

/** Each trial's story host, keyed by trial id: `TrialHost` attaches its element, an annotation target reads it. */
export interface StoryHosts {
  /** One ref per trial, the same object every time, holding its host while one is attached. */
  ref(trialId: string): RefObject<HTMLElement | null>;
  /** Returns the detach, which leaves a later attach for the same trial standing. */
  attach(trialId: string, host: HTMLElement): () => void;
}

export function createStoryHosts(): StoryHosts {
  const refs = new Map<string, RefObject<HTMLElement | null>>();
  const ref = (trialId: string) => {
    let held = refs.get(trialId);
    if (!held) {
      held = { current: null };
      refs.set(trialId, held);
    }
    return held;
  };
  return {
    ref,
    attach(trialId, host) {
      const held = ref(trialId);
      held.current = host;
      return () => {
        if (held.current === host) held.current = null;
      };
    },
  };
}

/** The workshop's `StoryHosts`; `null` outside a `Workshop`. */
export const StoryHostsContext = createContext<StoryHosts | null>(null);

/** Attaches `host` as the story host of trial `trialId` while both are given. */
export function useStoryHost(trialId: string | null | undefined, host: HTMLElement | null): void {
  const hosts = useContext(StoryHostsContext);
  useLayoutEffect(() => (host && hosts && trialId ? hosts.attach(trialId, host) : undefined), [host, hosts, trialId]);
}
