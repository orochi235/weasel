import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * How many Chromium processes run the browser project on a node with `cores` cores. Every tab of one
 * vitest process shares one Chromium, which caps it: more tabs there ran no faster, three processes
 * ran it 40-45% faster on 10-, 14- and 18-core nodes (`scripts/bench-browser-project.runs.jsonl`,
 * 2026-11-03). Nothing smaller was measured, so it keeps one.
 */
export const browserProcesses = (cores) => (cores >= 10 ? 3 : 1);

/**
 * The vitest argument lists that run the browser project as `n` concurrent processes, each its own
 * slice of the files. One list, unchanged, when `n` is 1 or the caller already asked for a slice.
 * An empty slice passes: three slices of two selected files leave one with none.
 */
export const browserShards = (argv, n) => {
  if (n <= 1 || argv.some((a) => a.startsWith('--shard'))) return [argv];
  const rest = argv.includes('--passWithNoTests') ? argv : [...argv, '--passWithNoTests'];
  return Array.from({ length: n }, (_, i) => [...rest, `--shard=${i + 1}/${n}`]);
};

/**
 * Carries one snapshot of the recorded durations to every process, so each computes the same split
 * (`scripts/vitest-duration-sequencer.ts`). Unset, vitest's own `--shard` cuts a hash-sorted list
 * into equal counts.
 */
export const DURATIONS_ENV = 'WEASEL_SHARD_DURATIONS';

const usable = (ms) => typeof ms === 'number' && Number.isFinite(ms) && ms >= 0;

/**
 * `ids` into `count` slices of near-equal recorded time: longest first, each into the slice holding
 * least so far. An id with no usable record weighs the median of those with one. Every process
 * given the same ids and durations computes the same slices, which is what keeps a file from
 * running twice or not at all.
 */
export const balancedSlices = (ids, durations, count) => {
  const known = ids.map((id) => durations[id]).filter(usable).sort((a, b) => a - b);
  const guess = known.length ? known[Math.floor(known.length / 2)] : 1;
  const weighted = [...new Set(ids)]
    .map((id) => ({ id, ms: usable(durations[id]) ? durations[id] : guess }))
    .sort((a, b) => b.ms - a.ms || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  const slices = Array.from({ length: count }, () => ({ ids: [], ms: 0 }));
  for (const { id, ms } of weighted) {
    const least = slices.reduce((best, s) => (s.ms < best.ms ? s : best));
    least.ids.push(id);
    least.ms += ms;
  }
  return slices;
};

/** A file's id in a split: its project and root-relative path, since one file can belong to two projects. */
export const sliceId = (project, file) => `${project}:${file}`;

/**
 * Each file's last recorded duration in `project`, keyed by `sliceId`, from every results cache
 * vitest keeps under `node_modules/.vite/vitest/`. A browser project records under each instance's
 * name, `browser (chromium)`, and those count too. The newest record wins. An absent, unreadable or
 * foreign-version cache adds nothing.
 */
export const recordedDurations = (root, project = 'browser') => {
  const dir = join(root, 'node_modules/.vite/vitest');
  const best = {};
  let hashes = [];
  try {
    hashes = readdirSync(dir);
  } catch {
    return {};
  }
  for (const hash of hashes) {
    let cache;
    try {
      cache = JSON.parse(readFileSync(join(dir, hash, 'results.json'), 'utf8'));
    } catch {
      continue;
    }
    if (cache?.version !== 1) continue;
    for (const [name, results] of Object.entries(cache.projects ?? {})) {
      if (name !== project && !name.startsWith(`${project} (`)) continue;
      for (const [file, r] of Object.entries(results?.files ?? {})) {
        if (!usable(r?.duration)) continue;
        const id = sliceId(name, file);
        const at = Number(r.lastRun) || 0;
        if (!best[id] || at > best[id].at) best[id] = { ms: r.duration, at };
      }
    }
  }
  return Object.fromEntries(Object.entries(best).map(([id, { ms }]) => [id, Math.round(ms)]));
};

/**
 * The environment that has every `--shard` process split the browser project by recorded duration,
 * or none under WEASEL_SHARD_SPLIT=hash.
 */
export const durationsEnv = (root, env = process.env) =>
  env.WEASEL_SHARD_SPLIT === 'hash' ? {} : { [DURATIONS_ENV]: JSON.stringify(recordedDurations(root)) };
