/**
 * Minimal `MediaQueryList` double with a manual `fire()`.
 *
 * Shared by every test that needs to drive the device profile's queries —
 * `useDeviceProfile` and `useCanvasSize` both watch them, and they must be
 * driven the same way or the two tests can disagree about what a density
 * change looks like.
 */
export function makeMatchMedia(matches: Record<string, boolean>) {
  const listeners = new Map<string, Set<(e: { matches: boolean }) => void>>();
  const state = { ...matches };
  const mm = (query: string) => ({
    matches: state[query] ?? false,
    media: query,
    addEventListener: (_: string, cb: (e: { matches: boolean }) => void) => {
      if (!listeners.has(query)) listeners.set(query, new Set());
      listeners.get(query)!.add(cb);
    },
    removeEventListener: (_: string, cb: (e: { matches: boolean }) => void) => {
      listeners.get(query)?.delete(cb);
    },
  });
  return {
    mm,
    fire(query: string, matches: boolean) {
      state[query] = matches;
      for (const cb of listeners.get(query) ?? []) cb({ matches });
    },
    listenerCount: (query: string) => listeners.get(query)?.size ?? 0,
  };
}
