import { createContext, useContext, type ReactNode } from 'react';

/**
 * Visual-regression backend selection.
 *
 * The visual-regression rig (`tests/visual/`) drives each demo under both
 * `backend='2d'` and `backend='gl'` by appending `?backend=gl` (or `?backend=2d`)
 * to the demo URL. Every demo's `<SceneCanvas>` reads `useBackend()` and passes
 * the value as the `backend` prop so the rig can switch renderers without
 * source changes.
 *
 * Default is `'2d'` until step-9 soak completes (see
 * `docs/superpowers/plans/2026-05-09-webgl-step-9-visual-regression-rig.md`).
 */
export type Backend = '2d' | 'gl';

const BackendContext = createContext<Backend>('2d');

function readBackendFromQuery(): Backend {
  if (typeof window === 'undefined') return '2d';
  const raw = new URLSearchParams(window.location.search).get('backend');
  return raw === 'gl' ? 'gl' : '2d';
}

export function BackendProvider({ children }: { children: ReactNode }) {
  // Read once at provider mount. The visual rig reloads the page between
  // backend switches, so a static read is sufficient — no need to react to
  // query-string changes mid-session.
  const backend = readBackendFromQuery();
  return <BackendContext.Provider value={backend}>{children}</BackendContext.Provider>;
}

export function useBackend(): Backend {
  return useContext(BackendContext);
}
