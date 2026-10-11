// src/test-hook/install.ts
import { createTestHook } from './createTestHook';
import type { TestHookRefs, WeaselTestHook } from './types';

/** Attach `window.__weaselTest` and return the hook iff
 *    - `process.env.NODE_ENV !== 'production'` (never in production consumer
 *      builds — paired with a call-site gate in SceneCanvas so the entire
 *      module DCEs out), AND
 *    - the URL contains `?test=1`, AND
 *    - no other canvas holds the global.
 *  Otherwise returns null and does not touch `window`. The caller that gets a
 *  hook owns it, and hands it to `releaseTestHook` when it unmounts. */
export function installTestHookIfRequested(refs: TestHookRefs): WeaselTestHook | null {
  if (typeof window === 'undefined') return null;
  // Defense in depth: even if the call-site gate is bypassed, never expose
  // the hook in production.
  if (typeof process !== 'undefined' && process.env?.NODE_ENV === 'production') return null;
  const params = new URLSearchParams(window.location.search);
  if (params.get('test') !== '1') return null;
  if (window.__weaselTest) return null;
  const hook = createTestHook(refs);
  window.__weaselTest = hook;
  return hook;
}

/** Remove `window.__weaselTest` if it is still `hook`. */
export function releaseTestHook(hook: WeaselTestHook): void {
  if (typeof window !== 'undefined' && window.__weaselTest === hook) delete window.__weaselTest;
}
