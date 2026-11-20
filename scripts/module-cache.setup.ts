import { fileURLToPath } from 'node:url';
import { MODULE_CACHE_ROOT } from './lib/module-cache.mjs';
import { pruneOlderThan } from './lib/prune-older-than.mjs';

const CACHE = fileURLToPath(new URL(`../${MODULE_CACHE_ROOT}`, import.meta.url));
const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * Bounds `fsModuleCache`. Its entries are keyed by content, so every edit writes new ones and nothing
 * removes the old: a fleet node's tree persists and keeps it (`scripts/lib/module-cache.mjs`). A hit never
 * rewrites its file, so a pruned entry that was still good costs one transform. A directory whose
 * external packages are no longer installed empties this way within the week.
 */
export default function setup() {
  pruneOlderThan(CACHE, Date.now() - WEEK_MS);
}
