// src/test-hook/install.ts
import { createTestHook } from './createTestHook';
import type { TestHookRefs, WeaselTestHook } from './types';

/** Hooks of the canvases mounted now, oldest first. `window.__weaselTest` is the first. */
const live: WeaselTestHook[] = [];

/** Make a hook for this canvas and return it iff
 *    - `process.env.NODE_ENV !== 'production'` (never in production consumer
 *      builds — paired with a call-site gate in `useTestHook` so the entire
 *      module DCEs out), AND
 *    - the URL contains `?test=1`, AND
 *    - `window.__weaselTest` is not held by something other than a canvas.
 *  Otherwise returns null and does not touch `window`. `window.__weaselTest`
 *  answers for the earliest canvas still mounted; the caller hands its hook to
 *  `releaseTestHook` when it unmounts. */
export function installTestHookIfRequested(refs: TestHookRefs): WeaselTestHook | null {
  if (typeof window === 'undefined') return null;
  // Defense in depth: even if the call-site gate is bypassed, never expose
  // the hook in production.
  if (typeof process !== 'undefined' && process.env?.NODE_ENV === 'production') return null;
  const params = new URLSearchParams(window.location.search);
  if (params.get('test') !== '1') return null;
  if (window.__weaselTest && window.__weaselTest !== live[0]) return null;
  const hook = createTestHook(refs);
  live.push(hook);
  window.__weaselTest = live[0];
  return hook;
}

/** Drop `hook`; if it held `window.__weaselTest`, the next canvas's hook takes over. */
export function releaseTestHook(hook: WeaselTestHook): void {
  const i = live.indexOf(hook);
  if (i < 0) return;
  const owned = typeof window !== 'undefined' && window.__weaselTest === hook;
  live.splice(i, 1);
  if (!owned) return;
  if (live.length > 0) window.__weaselTest = live[0];
  else delete window.__weaselTest;
}
