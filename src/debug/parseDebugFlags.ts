import type { DebugConfig, DebugFeature } from './types';

const ALL_FEATURES: DebugFeature[] = ['hitboxes', 'handles', 'bounds', 'origins', 'snap', 'layers'];

/**
 * Parse a URL query string (with or without leading `?`) for a `debug` param.
 *
 * - `?debug=hitboxes` → `{ hitboxes: true }`
 * - `?debug=bounds,origins` → `{ bounds: true, origins: true }`
 * - `?debug=all` → every feature enabled
 * - missing/empty/unknown-only → `null`
 */
export function parseDebugFlags(search: string): DebugConfig | null {
  const trimmed = search.startsWith('?') ? search.slice(1) : search;
  if (trimmed.length === 0) return null;
  const params = new URLSearchParams(trimmed);
  const raw = params.get('debug');
  if (!raw) return null;
  const tokens = raw.split(',').map((t) => t.trim()).filter(Boolean);
  if (tokens.length === 0) return null;
  if (tokens.includes('all')) {
    const out: DebugConfig = {};
    for (const f of ALL_FEATURES) out[f] = true;
    return out;
  }
  const out: DebugConfig = {};
  for (const t of tokens) {
    if ((ALL_FEATURES as string[]).includes(t)) out[t as DebugFeature] = true;
  }
  return Object.keys(out).length > 0 ? out : null;
}
