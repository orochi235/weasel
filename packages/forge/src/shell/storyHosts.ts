import { createContext, type RefObject, useContext, useLayoutEffect } from 'react';

/** Each trial's story host, keyed by trial id: `TrialHost` attaches its element, an annotation target reads it. */
export interface StoryHosts {
  /** One ref per trial, the same object every time, holding its host while one is attached. */
  ref(trialId: string): RefObject<HTMLElement | null>;
  /**
   * Returns the detach, which leaves a later attach for the same trial standing. `show` renders the host's content
   * while it is out of view, resolving once that has painted, with the release.
   */
  attach(trialId: string, host: HTMLElement, show?: () => Promise<() => void>): () => void;
  /** Renders trial `trialId`'s story wherever it is, until the release it resolves with is called. */
  show(trialId: string): Promise<() => void>;
}

export function createStoryHosts(): StoryHosts {
  const refs = new Map<string, RefObject<HTMLElement | null>>();
  const shows = new Map<string, { host: HTMLElement; show: () => Promise<() => void> }>();
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
    attach(trialId, host, show) {
      const held = ref(trialId);
      held.current = host;
      if (show) shows.set(trialId, { host, show });
      return () => {
        if (held.current === host) held.current = null;
        if (shows.get(trialId)?.host === host) shows.delete(trialId);
      };
    },
    show(trialId) {
      return shows.get(trialId)?.show() ?? Promise.resolve(() => {});
    },
  };
}

/** The workshop's `StoryHosts`; `null` outside a `Workshop`. */
export const StoryHostsContext = createContext<StoryHosts | null>(null);

/** Attaches `host` as the story host of trial `trialId` while both are given. */
export function useStoryHost(
  trialId: string | null | undefined,
  host: HTMLElement | null,
  show?: () => Promise<() => void>,
): void {
  const hosts = useContext(StoryHostsContext);
  useLayoutEffect(
    () => (host && hosts && trialId ? hosts.attach(trialId, host, show) : undefined),
    [host, hosts, trialId, show],
  );
}
