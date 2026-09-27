// Wait for a set of versions to list on the registry.
//
// npm holds a fresh upload as staged, invisible to every read, for up to about
// fifteen minutes before listing it (npm/cli#9889): 1.6.1's `hud` was uploaded
// at 17:30 UTC and listed at 17:44. A check run straight after the publish has
// to wait out that window before a missing version means anything.

/** Seconds between attempts: doubling from 15s, capped at 2 minutes. */
export const DEFAULT_DELAYS_MS = [15_000, 30_000, 60_000, 120_000];

const formatElapsed = (ms) => {
  const s = Math.round(ms / 1000);
  return `${String(Math.floor(s / 60)).padStart(2, ' ')}m${String(s % 60).padStart(2, '0')}s`;
};

/**
 * Check every package once, then keep re-checking the missing ones until they
 * all list or `budgetMs` is spent. `budgetMs: 0` is a single pass.
 *
 * Logs one line per package per attempt, so a long wait is visibly alive.
 *
 * @param {{ name: string, version: string }[]} packages
 * @param {{
 *   lookup: (pkg: { name: string, version: string }) => Promise<boolean>,
 *   budgetMs: number,
 *   delaysMs?: number[],
 *   sleep?: (ms: number) => Promise<void>,
 *   now?: () => number,
 *   log?: (line: string) => void,
 * }} options
 * @returns {Promise<{ missing: { name: string, version: string }[] }>}
 */
export async function awaitPublished(packages, options) {
  const {
    lookup,
    budgetMs,
    delaysMs = DEFAULT_DELAYS_MS,
    sleep = (ms) => new Promise((r) => setTimeout(r, ms)),
    now = Date.now,
    log = console.log,
  } = options;

  const start = now();
  const width = String(packages.length).length;
  let missing = [];

  for (const [i, pkg] of packages.entries()) {
    const live = await lookup(pkg);
    if (!live) missing.push(pkg);
    const n = String(i + 1).padStart(width, ' ');
    log(`[published] ${n}/${packages.length} ${pkg.name}@${pkg.version} — ${live ? 'ok' : 'MISSING'}`);
  }

  for (let attempt = 2; missing.length > 0; attempt++) {
    const remaining = budgetMs - (now() - start);
    if (remaining <= 0) break;
    const delay = Math.min(delaysMs[Math.min(attempt - 2, delaysMs.length - 1)], remaining);
    log(`[published] ${missing.length} not listed yet; checking again in ${Math.round(delay / 1000)}s`);
    await sleep(delay);

    const stillMissing = [];
    for (const pkg of missing) {
      const live = await lookup(pkg);
      if (!live) stillMissing.push(pkg);
      log(
        `[published] attempt ${attempt}, ${formatElapsed(now() - start)} in: ${pkg.name}@${pkg.version} — ${live ? 'ok' : 'MISSING'}`,
      );
    }
    missing = stillMissing;
  }

  return { missing };
}
