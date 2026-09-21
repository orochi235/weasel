import { useCallback, useEffect, useState } from 'react';

/** What forge keeps on a history entry: its place in the session, and whether reaching it swapped a trial's story in place. */
export interface RouteEntry {
  step: number;
  inPlace: boolean;
}

/** The story id `#/<id>` names, or null. */
export function readRoute(): string | null {
  const { hash } = location;
  if (!hash.startsWith('#/')) return null;
  return decodeURIComponent(hash.slice(2)) || null;
}

/** The current history entry's forge state, or null for one forge did not write, such as a typed URL. */
export function readRouteEntry(): RouteEntry | null {
  const state = history.state as { forgeRoute?: unknown } | null;
  const entry = state?.forgeRoute as RouteEntry | undefined;
  return typeof entry?.step === 'number' ? entry : null;
}

/** Whether moving between two entries crosses an in-place swap: back off one, or forward onto one. */
export function crossesInPlace(from: RouteEntry | null, to: RouteEntry | null): boolean {
  if (!from || !to || from.step === to.step) return false;
  return to.step < from.step ? from.inPlace : to.inPlace;
}

function stamp(entry: RouteEntry, hash: string): void {
  history.replaceState({ ...(history.state ?? {}), forgeRoute: entry }, '', hash);
}

/** The story the URL names, and a way to name another; `inPlace` says the new story replaced the old one in its trial. */
export function useRoute(): [string | null, (id: string, options?: { inPlace?: boolean }) => void] {
  const [route, setRoute] = useState(readRoute);
  useEffect(() => {
    const sync = (): void => setRoute(readRoute());
    window.addEventListener('hashchange', sync);
    sync();
    return () => window.removeEventListener('hashchange', sync);
  }, []);
  const go = useCallback((id: string, options: { inPlace?: boolean } = {}) => {
    const hash = `#/${encodeURIComponent(id)}`;
    if (readRoute() === id) {
      history.replaceState(history.state, '', hash);
      return;
    }
    const from = readRouteEntry() ?? { step: 0, inPlace: false };
    stamp(from, location.hash);
    location.hash = hash;
    stamp({ step: from.step + 1, inPlace: options.inPlace ?? false }, hash);
  }, []);
  return [route, go];
}
