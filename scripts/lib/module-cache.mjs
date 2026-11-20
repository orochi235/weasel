/**
 * Where vitest's `fsModuleCache` lives, and keeping vitest from clearing it for a lockfile change that
 * moves no external package. vitest keeps it in `node_modules/.vitest-cache` and clears it whenever
 * `node_modules/.package-lock.json` changes, so a workspace version bump or an `npm ci` on a fleet node
 * transformed every module again: transform was 39% of batch 2026-11-19-d's summed time, which
 * reinstalled, against 3% for batches b3, c and c2, which did not.
 */
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

/** The cache's root, ignored by git, so onto's sync leaves it in a node's tree and `npm ci` never reaches it. */
export const MODULE_CACHE_ROOT = '.vitest-cache';
/** vitest's own record of the lockfile it last saw (`ensureCacheIntegrity` in vitest's cli-api). */
const METADATA = '_metadata.json';

const sha256 = (text) => createHash('sha256').update(text).digest('hex');

/**
 * A hash of what a lockfile installs where, which a cached transform's resolved imports depend on: every
 * external package by path, version and integrity, and every workspace link by where it points. A
 * workspace's own entry, its version among it, is left out.
 */
export const externalHash = (lock) => {
  const external = Object.entries(lock.packages ?? {})
    .filter(([key]) => key.startsWith('node_modules/') || key.includes('/node_modules/'))
    .map(([key, entry]) => (entry.link ? `${key}->${entry.resolved}` : `${key}@${entry.version ?? ''}#${entry.integrity ?? entry.resolved ?? ''}`))
    .sort();
  return sha256(external.join('\n')).slice(0, 16);
};

/** vitest's hash of the installed lockfile, as it computes it, so the record it reads says nothing changed. */
const vitestLockHash = (root) => {
  const at = join(root, 'node_modules/.package-lock.json');
  return sha256(existsSync(at) ? readFileSync(at, 'utf8') : '').slice(0, 8).padEnd(8, '_');
};

/**
 * The cache directory for the external packages `root`'s lockfile installs. A change to those is a new
 * directory, so it starts cold as vitest's own clearing would; anything else keeps the old one, with
 * vitest's record rewritten to the installed lockfile so it does not clear it.
 */
export const moduleCacheDir = (root) => {
  const dir = join(root, MODULE_CACHE_ROOT, externalHash(JSON.parse(readFileSync(join(root, 'package-lock.json'), 'utf8'))));
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, METADATA), JSON.stringify({ lockfileHash: vitestLockHash(root) }, null, 2));
  return dir;
};
