/**
 * What earlier rounds left on disk, and what that says about tonight. Nothing here keeps its own
 * ledger: an area's history is the `docs/audits/round-<N>/<area>/area.json` files that name it.
 */
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

export const AUDITS_DIR = 'docs/audits';
export const HARDENING = 'docs/hardening.md';
/** A pass that found at most this many distinct defects counts toward settling its area. */
export const QUIET_PASS = 1;

/** Chapman's estimate of how many defects the area held, from two lists of `a` and `b` sharing `m`. */
export const chapman = (a, b, m) => (a + 1) * (b + 1) / (m + 1) - 1;

/** Every pass on disk, by area id, oldest first. */
export const readPasses = (root) => {
  const dir = join(root, AUDITS_DIR);
  const passes = new Map();
  if (!existsSync(dir)) return passes;
  const rounds = readdirSync(dir).flatMap((name) => /^round-(\d+)$/.exec(name)?.[1] ?? []).map(Number);
  for (const round of rounds.sort((x, y) => x - y)) {
    const roundDir = join(dir, `round-${round}`);
    for (const area of readdirSync(roundDir, { withFileTypes: true })) {
      const at = join(roundDir, area.name, 'area.json');
      if (!area.isDirectory() || !existsSync(at)) continue;
      const pass = { round, ...JSON.parse(readFileSync(at, 'utf8')) };
      if (!passes.has(pass.id)) passes.set(pass.id, []);
      passes.get(pass.id).push(pass);
    }
  }
  return passes;
};

/**
 * The round after every number already used: round directories, the hardening record's rows and
 * its practices table ("rounds 28–30"), and branches named for a round (`audit30-ui`, `batch/…-audit31`).
 */
export const nextRound = ({ roundDirs = [], hardening = '', branches = [] }) => {
  const used = [0];
  for (const name of roundDirs) {
    const m = /^round-(\d+)$/.exec(name);
    if (m) used.push(Number(m[1]));
  }
  for (const m of hardening.matchAll(/\brounds? (\d+)(?:\s*[–-]\s*(\d+))?/g)) used.push(Number(m[1]), Number(m[2] ?? 0));
  for (const name of branches) {
    const m = /(?:^|[/-])audit(\d+)(?:-|$)/.exec(name);
    if (m) used.push(Number(m[1]));
  }
  return Math.max(...used) + 1;
};

const sameFiles = (a, b) => a.length === b.length && a.every((f, i) => f === b[i]);

/**
 * Whether an area's two latest passes settle it: each found at most QUIET_PASS distinct defects, both
 * read the same file list as the area has now, and nothing but the passes' own fixes changed those
 * files since the first of them. `touched(files, from, exclude)` answers whether a commit after
 * `from` and not in `exclude` changed any of `files`.
 */
export const isSettled = (area, passes, touched) => {
  if (passes.length < 2) return false;
  const [first, last] = passes.slice(-2);
  if (first.distinct > QUIET_PASS || last.distinct > QUIET_PASS) return false;
  if (!sameFiles(first.files, area.files) || !sameFiles(last.files, area.files)) return false;
  return !touched(area.files, first.commit, [...(first.fixCommits ?? []), ...(last.fixCommits ?? [])]);
};

/**
 * Tonight's areas: never audited first, in partition order, then the longest since their last pass;
 * settled areas are skipped. Answers `{ picked, settled }`, each a list of ids.
 */
export const pickAreas = ({ areas, passes, touched, count }) => {
  const settled = [];
  const fresh = [];
  const seen = [];
  for (const area of areas) {
    const history = passes.get(area.id) ?? [];
    if (history.length === 0) {
      fresh.push(area.id);
      continue;
    }
    if (isSettled(area, history, touched)) settled.push(area.id);
    else seen.push({ id: area.id, last: history.at(-1).round });
  }
  seen.sort((x, y) => x.last - y.last || (x.id < y.id ? -1 : 1));
  return { picked: [...fresh, ...seen.map((s) => s.id)].slice(0, count), settled };
};

/** A `touched` for `isSettled` that asks git. */
export const gitTouched = (git) => (files, from, exclude) => {
  if (files.length === 0) return false;
  let out;
  try {
    out = git('log', '--no-merges', '--format=%H', `${from}..HEAD`, '--', ...files);
  } catch {
    return true;
  }
  const skip = new Set(exclude);
  return out.split('\n').some((sha) => sha && !skip.has(sha));
};
