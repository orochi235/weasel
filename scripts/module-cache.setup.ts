import { readdirSync, rmSync } from 'node:fs';
import { basename, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { MODULE_CACHE_ROOT, moduleCacheDir } from './lib/module-cache.mjs';
import { pruneCache } from './lib/prune-cache.mjs';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const CACHE = join(ROOT, MODULE_CACHE_ROOT);
const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
/** About three times what one lockfile's directory held on teitou after three days of continuous runs (2026-11-22). */
const MAX_BYTES = 2e9;

/**
 * Bounds `fsModuleCache` at the start of every run. Its entries are keyed by content, so every edit writes
 * new ones and nothing removes the old: a fleet node's tree persists and keeps it
 * (`scripts/lib/module-cache.mjs`). Only the installed lockfile's directory is kept, so a branch on another
 * lockfile in the same tree starts cold; that directory then loses what is past a week old and its oldest
 * entries past the cap. A hit never rewrites its file, so a pruned entry that was still good costs one transform.
 */
export default function setup() {
  const live = basename(moduleCacheDir(ROOT));
  for (const dir of readdirSync(CACHE)) {
    if (dir !== live) rmSync(join(CACHE, dir), { recursive: true, force: true });
  }
  pruneCache(join(CACHE, live), { before: Date.now() - WEEK_MS, maxBytes: MAX_BYTES });
}
