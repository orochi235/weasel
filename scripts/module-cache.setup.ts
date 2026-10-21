import { fileURLToPath } from 'node:url';
import { pruneOlderThan } from './lib/prune-older-than.mjs';

const CACHE = fileURLToPath(new URL('../node_modules/.vitest-cache', import.meta.url));
const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * Bounds `fsModuleCache`. Its entries are keyed by content, so every edit writes new ones and nothing
 * removes the old: a fleet node's tree persists, and only `npm ci` would clear it. A hit never
 * rewrites its file, so a pruned entry that was still good costs one transform.
 */
export default function setup() {
  pruneOlderThan(CACHE, Date.now() - WEEK_MS);
}
