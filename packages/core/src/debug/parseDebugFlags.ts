import type { DebugFlags, DebugFeature } from './types';
import { DEBUG_FEATURES } from './features';

/**
 * Parse a URL query string (with or without leading `?`) for a `debug` param.
 *
 * - `?debug=hitboxes` → `{ hitboxes: true }`
 * - `?debug=bounds,origins` → `{ bounds: true, origins: true }`
 * - `?debug=all` → every feature enabled
 * - missing/empty/unknown-only → `null`
 */
export function parseDebugFlags(search: string): DebugFlags | null {
  const trimmed = search.startsWith('?') ? search.slice(1) : search;
  if (trimmed.length === 0) return null;
  const params = new URLSearchParams(trimmed);
  const raw = params.get('debug');
  if (!raw) return null;
  const tokens = raw.split(',').map((t) => t.trim()).filter(Boolean);
  if (tokens.length === 0) return null;
  if (tokens.includes('all')) {
    const out: DebugFlags = {};
    for (const f of DEBUG_FEATURES) out[f] = true;
    return out;
  }
  const out: DebugFlags = {};
  for (const t of tokens) {
    if ((DEBUG_FEATURES as readonly string[]).includes(t)) out[t as DebugFeature] = true;
  }
  return Object.keys(out).length > 0 ? out : null;
}

/**
 * A surface's `debug` prop as it takes effect: a config is itself, `false` is
 * off, and `undefined` reads `?debug=…` from the URL. Null when off.
 */
export function resolveDebugFlags(debug: DebugFlags | false | undefined): DebugFlags | null {
  if (debug === false) return null;
  if (debug !== undefined) return debug;
  return typeof window === 'undefined' ? null : parseDebugFlags(window.location.search);
}
