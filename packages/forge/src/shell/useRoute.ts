import { useEffect, useState } from 'react';
import { formatRoute, parseRoute } from '../route/url';

/** What forge keeps on a history entry: its place in the session, and whether reaching it swapped a trial's story in place. */
export interface RouteEntry {
  step: number;
  inPlace: boolean;
  /** Set until the knobs first sync: the entry was written for a trial already showing the story, whose config stands. */
  fromTrial?: boolean;
}

/** The story id `#/<id>` names, or null. */
export function readRoute(): string | null {
  return parseRoute(location.hash).story;
}

/** Every param after the story id: its knobs, and the workshop's reserved params. */
export function readRouteParams(): Record<string, string> {
  return { ...parseRoute(location.hash).params };
}

/**
 * Rewrites the current story's params in place, with no new history entry: `update` is handed every param and
 * returns the ones to keep. The one way anything writes a param, so knobs and reserved params do not overwrite
 * each other. A no-op when no story is named.
 */
export function replaceRouteParams(update: (params: Record<string, string>) => Record<string, string>): void {
  const { story, params } = parseRoute(location.hash);
  if (story === null) return;
  const next = formatRoute({ story, params: update({ ...params }) });
  if (next !== location.hash) history.replaceState(history.state, '', next);
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

/**
 * Names story `id` in the URL; `inPlace` says it replaced the previous story in its trial. A different story starts
 * with no params, so one story's knobs never reach the next; `fromTrial` says a trial already shows it, and that
 * trial's knobs are written to the URL where they would otherwise be read from it. Naming the current story again
 * keeps the params it has.
 */
export function setRoute(id: string, options: { inPlace?: boolean; fromTrial?: boolean } = {}): void {
  if (readRoute() === id) {
    history.replaceState(history.state, '', formatRoute({ story: id, params: readRouteParams() }));
    return;
  }
  const hash = formatRoute({ story: id, params: {} });
  const from = readRouteEntry() ?? { step: 0, inPlace: false };
  stamp(from, location.hash);
  location.hash = hash;
  stamp({ step: from.step + 1, inPlace: options.inPlace ?? false, ...(options.fromTrial ? { fromTrial: true } : {}) }, hash);
}

/** Whether the current entry was written for a trial already showing its story; asking clears it, so it answers yes once. */
export function takeRouteFromTrial(): boolean {
  const entry = readRouteEntry();
  if (!entry?.fromTrial) return false;
  stamp({ step: entry.step, inPlace: entry.inPlace }, location.hash);
  return true;
}

/** The story the URL names, and `setRoute` to name another. */
export function useRoute(): [string | null, typeof setRoute] {
  const [route, setCurrent] = useState(readRoute);
  useEffect(() => {
    const sync = (): void => setCurrent(readRoute());
    window.addEventListener('hashchange', sync);
    sync();
    return () => window.removeEventListener('hashchange', sync);
  }, []);
  return [route, setRoute];
}
