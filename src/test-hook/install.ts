// src/test-hook/install.ts
import { createTestHook } from './createTestHook';
import type { TestHookRefs, WeaselTestHook } from './types';

/** Attach `window.__weaselTest` and return the hook iff
 *    - `import.meta.env.MODE !== 'production'` (never in published kit bundles), AND
 *    - the URL contains `?test=1`.
 *  Otherwise returns null and does not touch `window`. */
export function installTestHookIfRequested(refs: TestHookRefs): WeaselTestHook | null {
  if (typeof window === 'undefined') return null;
  // Production bundles must never expose the hook, full stop.
  if (import.meta.env.MODE === 'production') return null;
  const params = new URLSearchParams(window.location.search);
  if (params.get('test') !== '1') return null;
  // If a hook is already installed (HMR), keep it.
  if (window.__weaselTest) return window.__weaselTest;
  const hook = createTestHook(refs);
  window.__weaselTest = hook;
  return hook;
}
