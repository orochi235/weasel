// What the first-publish gate decides from the registry's packuments.
//
// npm serves trust config only to a maintainer's token (`npm trust list` is a
// 401 without one), and the gate runs in CI with none. What the public
// packument does show is who published each version: a trusted publish carries
// `_npmUser.trustedPublisher`. A package with no such version may still have
// trust config, registered after its first publish by hand and not yet used,
// and that state is told apart only by `scripts/trust-pending.json`, which
// `setup-trusted-publishing.mjs` writes.
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fetchPackument } from './registry.mjs';
import { repoRoot } from './workspaces.mjs';

export const PENDING_FILE = join(repoRoot, 'scripts', 'trust-pending.json');

export function hasTrustedPublish(packument) {
  return Object.values(packument?.versions ?? {}).some((m) => m?._npmUser?.trustedPublisher);
}

/**
 * Each package's status, given `[{ name, packument }]` (packument `null` for a
 * name the registry has never heard of) and the names recorded as registered
 * but not yet published by the release job.
 *
 * - `missing`: never published; OIDC cannot create it.
 * - `untrusted`: on npm, never published by a trusted publisher, not pending.
 * - `pending`: on npm, trust registered, waiting for its first CI publish.
 * - `stale`: a pending entry whose package has had that publish.
 */
export function classify(states, pending) {
  const pendingSet = new Set(pending);
  const status = {};
  const missing = [];
  const untrusted = [];
  const stale = [];
  for (const { name, packument } of states) {
    if (!packument) {
      status[name] = 'missing';
      missing.push(name);
    } else if (hasTrustedPublish(packument)) {
      status[name] = 'ok';
      if (pendingSet.has(name)) stale.push(name);
    } else if (pendingSet.has(name)) {
      status[name] = 'pending';
    } else {
      status[name] = 'untrusted';
      untrusted.push(name);
    }
  }
  return { status, missing, untrusted, stale };
}

/**
 * Each name's packument, as `classify` takes them. A registry error (anything
 * but 200 or 404 after retrying) is fatal unless `warn`, when the name is left
 * out of `states` and reported in `errors`: `--warn` is the CI gate, where an
 * npm outage is not a fault of the commit.
 */
export async function readStates(names, { warn = false, onEach, ...fetchOpts } = {}) {
  const states = [];
  const errors = [];
  for (const [i, name] of names.entries()) {
    let state;
    try {
      state = { name, packument: await fetchPackument(name, fetchOpts) };
    } catch (err) {
      if (!warn) throw err;
      errors.push({ name, message: err.message });
    }
    if (state) states.push(state);
    onEach?.(i, name, state ?? null);
  }
  return { states, errors };
}

export function addPending(current, names) {
  return [...new Set([...current, ...names])].sort();
}

export function readPending(file = PENDING_FILE) {
  return existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) : [];
}

export function writePending(names, file = PENDING_FILE) {
  writeFileSync(file, `${JSON.stringify(names, null, 2)}\n`);
}
