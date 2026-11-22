import { fileURLToPath } from 'node:url';
import { MODULE_CACHE_ROOT } from './lib/module-cache.mjs';
import { pruneCache } from './lib/prune-cache.mjs';

const CACHE = fileURLToPath(new URL(`../${MODULE_CACHE_ROOT}`, import.meta.url));
const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
/** About three times what one lockfile's directory held on teitou after three days of continuous runs (2026-11-22). */
const MAX_BYTES = 2e9;

/**
 * Bounds `fsModuleCache`. Its entries are keyed by content, so every edit writes new ones and nothing
 * removes the old: a fleet node's tree persists and keeps it (`scripts/lib/module-cache.mjs`), along with
 * the directory of every lockfile a branch synced there brought. A hit never rewrites its file, so a
 * pruned entry that was still good costs one transform.
 */
export default function setup() {
  pruneCache(CACHE, { before: Date.now() - WEEK_MS, maxBytes: MAX_BYTES });
}
