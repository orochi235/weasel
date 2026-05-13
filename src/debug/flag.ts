/**
 * Kit-level debug flag, gated by localStorage.
 *
 * Set `localStorage.setItem('weasel.debug', '1')` (or `'swillustrator.debug'`
 * — both are recognized) in the browser console to enable verbose
 * diagnostics throughout the kit and its consumers:
 *
 *   - every history op push (`[history.applyOps] …`)
 *   - active tool / hotkey transitions (`[tools] active: …`)
 *   - selection mutations (`[selection] …`)
 *   - gesture cancels (`[dispatch] cancel reason=…`)
 *   - no-op op batch suppression warnings
 *
 * Clear with `localStorage.removeItem('weasel.debug')`. Off by default —
 * production builds strip `console.debug` regardless.
 *
 * The flag is read once and cached for the page session. Reload to pick
 * up a change.
 */

const KEYS = ['weasel.debug', 'swillustrator.debug'] as const;

let cached: boolean | null = null;

function read(): boolean {
  if (typeof localStorage === 'undefined') return false;
  try {
    for (const k of KEYS) {
      const v = localStorage.getItem(k);
      if (v === '1' || v === 'true') return true;
    }
    return false;
  } catch {
    return false;
  }
}

/** True when the debug flag is set. Cached after first read for cheap
 *  hot-path checks; reload the page to pick up a change. */
export function isDebugEnabled(): boolean {
  if (cached === null) cached = read();
  return cached;
}

/** Conditional console.debug — no-op when the flag is off. Use this for
 *  any kit-level diagnostic that fires more than a handful of times per
 *  session, so the console stays quiet by default. */
export function dlog(...args: unknown[]): void {
  if (!isDebugEnabled()) return;
  // eslint-disable-next-line no-console
  console.debug(...args);
}

/** Conditional console.warn — no-op when the flag is off. Use for kit-level
 *  diagnostics that aren't strictly user-facing but indicate something
 *  worth surfacing during debugging (e.g. no-op op batches suppressed). */
export function dwarn(...args: unknown[]): void {
  if (!isDebugEnabled()) return;
  // eslint-disable-next-line no-console
  console.warn(...args);
}
