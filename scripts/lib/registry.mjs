// Registry lookups for the release gates.
//
// Everything here talks to `registry.npmjs.org` over HTTP rather than shelling
// out to `npm view`. `npm view` answers from a cached packument and has
// reported `ETARGET` for a version that was already live, which is exactly the
// wrong answer for a check whose whole job is to tell a real partial release
// from a slow one.

const DEFAULT_REGISTRY = 'https://registry.npmjs.org';

export function registryBase() {
  return (process.env.npm_config_registry ?? DEFAULT_REGISTRY).replace(/\/$/, '');
}

const encodeName = (name) => name.replace('/', '%2f');

/**
 * Poll `url` until it answers 200 or 404 runs out of attempts.
 *
 * A publish takes a minute or two to reach every read replica, so a 404
 * immediately after one is indistinguishable from a publish that never
 * happened. Retrying is what separates them; anything other than 200/404 is a
 * registry problem and throws rather than being read as absence.
 */
async function existsWithRetry(url, label, { attempts, delayMs }) {
  for (let attempt = 1; ; attempt++) {
    const res = await fetch(url, {
      method: 'GET',
      headers: { accept: 'application/json' },
    });
    if (res.status === 200) return true;
    if (res.status !== 404) {
      throw new Error(`${label}: registry answered ${res.status} ${res.statusText}`);
    }
    if (attempt >= attempts) return false;
    await new Promise((r) => setTimeout(r, delayMs));
  }
}

/** Whether the registry has heard of a package at all. */
export function isPublished(name, { attempts = 3, delayMs = 4000 } = {}) {
  return existsWithRetry(`${registryBase()}/${encodeName(name)}`, name, { attempts, delayMs });
}

/**
 * Whether one exact version of a package is on the registry.
 *
 * Asks for the version manifest directly instead of reading the packument's
 * `versions` map, so a stale packument cannot answer for a version published
 * seconds ago.
 */
export function hasVersion(name, version, { attempts = 5, delayMs = 6000 } = {}) {
  const url = `${registryBase()}/${encodeName(name)}/${encodeURIComponent(version)}`;
  return existsWithRetry(url, `${name}@${version}`, { attempts, delayMs });
}
