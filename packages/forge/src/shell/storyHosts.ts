import { createContext, type RefObject, useContext, useLayoutEffect } from 'react';

/** Each trial's story host, keyed by trial id: `TrialHost` attaches its element, an annotation target reads it. */
export interface StoryHosts {
  /**
   * The ref to trial `trialId`'s host, holding it while one is attached: the same object until that host detaches,
   * when the table lets the trial go. A ref kept past that still reads the trial's host, attached or not.
   */
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
  const hosts = new Map<string, HTMLElement>();
  // Each ref reads `hosts` live, so one a caller still holds after its trial's detach dropped it stays true.
  const refs = new Map<string, RefObject<HTMLElement | null>>();
  const shows = new Map<string, { host: HTMLElement; show: () => Promise<() => void> }>();
  const ref = (trialId: string) => {
    let held = refs.get(trialId);
    if (!held) {
      held = {
        get current() {
          return hosts.get(trialId) ?? null;
        },
      } as RefObject<HTMLElement | null>;
      refs.set(trialId, held);
    }
    return held;
  };
  return {
    ref,
    attach(trialId, host, show) {
      hosts.set(trialId, host);
      if (show) shows.set(trialId, { host, show });
      return () => {
        if (hosts.get(trialId) === host) {
          hosts.delete(trialId);
          refs.delete(trialId);
        }
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
