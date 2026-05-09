import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { registerFont } from '@orochi235/weasel-gl';

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
  const [fontReady, setFontReady] = useState(backend === '2d');

  useEffect(() => {
    if (backend !== 'gl') return;
    let cancelled = false;
    // Register the inter MSDF atlas under both 'sans-serif' (default
    // fontFamily of resolveTextStyle) and 'Inter' so demos that use either
    // get glyphs under backend='gl'. The font assets are served from
    // packages/weasel-gl/fonts via the publicDir override in vite.config.ts.
    const base = `${import.meta.env.BASE_URL}inter`;
    Promise.all([
      registerFont('sans-serif', `${base}/inter.json`, `${base}/inter.png`),
      registerFont('Inter',      `${base}/inter.json`, `${base}/inter.png`),
    ])
      .then(() => { if (!cancelled) setFontReady(true); })
      .catch((e) => {
        console.warn('demo: failed to register Inter font for backend=gl:', e);
        if (!cancelled) setFontReady(true);
      });
    return () => { cancelled = true; };
  }, [backend]);

  // Block rendering until the font is registered under backend='gl' so the
  // first paint includes glyphs. Under backend='2d' fontReady defaults true.
  if (!fontReady) return null;
  return <BackendContext.Provider value={backend}>{children}</BackendContext.Provider>;
}

export function useBackend(): Backend {
  return useContext(BackendContext);
}
