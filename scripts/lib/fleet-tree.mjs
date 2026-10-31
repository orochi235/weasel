import { createHash } from 'node:crypto';
import { appendFileSync, existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, matchesGlob } from 'node:path';

/** Untracked and not ignored, so `onto test` sends it with the tree and the next sync cleans it away. */
export const MARKER = '.onto/fleet-tree.json';
export const COMMIT_ENV = 'WEASEL_FLEET_COMMIT';
const STEP_ENV = 'WEASEL_FLEET_STEP';
/** Where onto records what its last sync into a node's tree left there. */
export const ONTO_STAMP = '.git/onto-stamp';
const PLAN = '.onto/tests';
const REGULAR = /^100(644|755)$/;

export const blobHash = (bytes) => createHash('sha1').update(`blob ${bytes.length}\0`).update(bytes).digest('hex');

/** The files of `git diff --raw --no-renames --no-abbrev -z <base> <commit>`, by path. */
export const changedFiles = (rawDiff) => {
  const files = {};
  const fields = rawDiff.split('\0');
  for (let i = 0; i + 1 < fields.length; i += 2) {
    const [, newMode, , newId, status] = fields[i].replace(/^:/, '').split(' ');
    const path = fields[i + 1];
    if (path === PLAN) continue;
    if (status === 'D') files[path] = null;
    else if (REGULAR.test(newMode)) files[path] = newId;
  }
  return files;
};

/**
 * The marker says what the tree must hold, and travels with the tree. The commit the run asks for
 * travels with the job, so a sync from another session cannot rewrite it. Returned as `K=V` for
 * `onto do --env`; with `plan`, also exported by the plan's prelude, which `onto test` (no `--env`)
 * reads on this machine and sends in the launch request.
 */
export const armTree = (tree, marker, { plan = false } = {}) => {
  writeFileSync(join(tree, MARKER), `${JSON.stringify(marker, null, 1)}\n`);
  const env = `${COMMIT_ENV}=${marker.commit}`;
  if (plan) {
    const at = join(tree, PLAN);
    const gap = readFileSync(at, 'utf8').endsWith('\n') ? '' : '\n';
    appendFileSync(at, `${gap}prelude: export ${env}\n`);
  }
  return env;
};

const fileProblem = (root, path, id) => {
  const full = join(root, path);
  if (id === null) return existsSync(full) ? `${path} exists, and the commit deletes it` : undefined;
  if (!existsSync(full)) return `${path} is missing`;
  return blobHash(readFileSync(full)) === id ? undefined : `${path} differs from the commit`;
};

export const checkTree = (root, env) => {
  const asked = env[COMMIT_ENV] || undefined;
  const at = join(root, MARKER);
  if (!existsSync(at)) {
    const problems = asked ? [`no ${MARKER}: this tree was not sent by the run that asked for ${asked}`] : [];
    return { armed: Boolean(asked), commit: asked, checked: 0, problems };
  }
  const marker = JSON.parse(readFileSync(at, 'utf8'));
  if (!asked) {
    const why = `${MARKER} says ${marker.commit}, and the job named no commit in ${COMMIT_ENV}; a marker alone is whichever run synced last`;
    return { armed: true, commit: marker.commit, checked: 0, problems: [why] };
  }
  if (marker.commit !== asked) {
    return { armed: true, commit: asked, checked: 0, problems: [`this tree is ${marker.commit}, and the run asked for ${asked}`] };
  }
  const entries = Object.entries(marker.files);
  const problems = entries.flatMap(([path, id]) => fileProblem(root, path, id) ?? []);
  return { armed: true, commit: marker.commit, checked: entries.length, problems };
};

const LOCKFILE = 'package-lock.json';
const UNSOURCED = new Set(['node_modules', 'dist']);

const filesUnder = (root, dir) =>
  readdirSync(join(root, dir), { recursive: true, withFileTypes: true })
    .filter((entry) => entry.isFile())
    .map((entry) => join(entry.parentPath, entry.name).slice(root.length + 1))
    .filter((path) => !path.split('/').some((part) => UNSOURCED.has(part)));

/**
 * The workspace directories a lockfile change touches, from the `packages` maps before and after: null
 * when it changes an external package or the root entry, which can reach any workspace.
 */
export const lockScope = (before, after) => {
  const was = before.packages ?? {};
  const now = after.packages ?? {};
  const dirs = new Set();
  for (const key of new Set([...Object.keys(was), ...Object.keys(now)])) {
    if (JSON.stringify(was[key]) === JSON.stringify(now[key])) continue;
    const link = now[key]?.link ? now[key] : was[key]?.link ? was[key] : undefined;
    if (link) dirs.add(link.resolved);
    else if (/^packages\/[^/]+$/.test(key)) dirs.add(key);
    else return null;
  }
  return [...dirs].sort();
};

/**
 * What a branch run changes, as repo paths: `changed`, the marker's `select` list, `reshaped`, the
 * ones in it the branch adds or deletes, and `seed`, what the run selects tests from. Undefined, so
 * everything runs, unless the marker carries that list and is this run's, and when a listed path
 * matches one of `triggers`. A path matching `scoped` belongs to the workspace or app its first two
 * segments name, and so does the lockfile when the marker's `lockScope` lists what it touched: in
 * `seed` such a path is replaced by every file of what it belongs to, which reaches that package's
 * tests and its dependents' without running everything.
 */
export const branchChanges = (root, env, { triggers, scoped = [] }) => {
  const at = join(root, MARKER);
  if (!existsSync(at)) return undefined;
  const marker = JSON.parse(readFileSync(at, 'utf8'));
  if (!Array.isArray(marker.select) || env[STEP_ENV] || !env[COMMIT_ENV] || marker.commit !== env[COMMIT_ENV]) return undefined;
  const changed = marker.select;
  const scopeOf = (path) => {
    if (path === LOCKFILE) return Array.isArray(marker.lockScope) ? marker.lockScope : undefined;
    return scoped.some((glob) => matchesGlob(path, glob)) ? [path.split('/').slice(0, 2).join('/')] : undefined;
  };
  const dirs = new Set();
  const direct = [];
  for (const path of changed) {
    const scope = scopeOf(path);
    if (scope) scope.forEach((dir) => dirs.add(dir));
    else if (triggers.some((glob) => matchesGlob(path, glob))) return undefined;
    else direct.push(path);
  }
  const owned = [...dirs].filter((dir) => existsSync(join(root, dir))).flatMap((dir) => filesUnder(root, dir));
  const seed = [...new Set([...direct, ...owned])];
  return { changed, reshaped: Array.isArray(marker.reshaped) ? marker.reshaped : changed, seed };
};

/** The branch a fleet run tests, when the marker is this run's and names one other than main. */
export const fleetBranch = (root, env) => {
  const at = join(root, MARKER);
  if (!existsSync(at) || !env[COMMIT_ENV]) return undefined;
  const marker = JSON.parse(readFileSync(at, 'utf8'));
  if (marker.commit !== env[COMMIT_ENV] || typeof marker.branch !== 'string' || !marker.branch || marker.branch === 'main') return undefined;
  return marker.branch;
};

/** The paths a branch run limits the suite to, absolute, for vitest's `related`: `branchChanges` plus `always`. */
export const selection = (root, env, { always, triggers, scoped }) => {
  const changes = branchChanges(root, env, { triggers, scoped });
  return changes && [...changes.seed, ...always].map((path) => join(root, path));
};

/**
 * The environment for a process a fleet job spawns, such as a ci.yml step that starts vitest. It
 * keeps the commit, so that process's tree check still has the job's word for it, and turns off
 * the branch selection, which belongs to the job's own suite.
 */
export const stepEnv = (env) => ({ ...env, [STEP_ENV]: '1' });

/** What a fleet run prints about its tree: the line that proves the match, or why nothing else in the run counts. */
export const treeReport = (check) => check.problems.length === 0
  ? { ok: true, text: `fleet-tree: ${check.checked} changed path(s) match ${check.commit}` }
  : { ok: false, text: `this fleet run tested the wrong tree, so no other result in it counts:\n  ${check.problems.slice(0, 20).join('\n  ')}` };

const readOr = (path) => {
  try {
    return readFileSync(path);
  } catch {
    return undefined;
  }
};

/**
 * What the tree was last synced to: onto's own stamp, and the marker the run armed, which a sync from
 * another session replaces or removes. Two reads that differ mean a sync landed between them.
 */
export const treeStamp = (root) => {
  const onto = readOr(join(root, ONTO_STAMP));
  let synced = '-';
  if (onto) {
    try {
      synced = JSON.parse(onto.toString('utf8')).stamp || '-';
    } catch {
      synced = `unreadable:${blobHash(onto).slice(0, 12)}`;
    }
  }
  const marker = readOr(join(root, MARKER));
  return `${synced}/${marker ? blobHash(marker).slice(0, 12) : 'no-marker'}`;
};

/** What a fleet run prints at its end about the tree it ran in. */
export const stampReport = (before, after) => before === after
  ? { ok: true, text: `fleet-tree: the tree held ${before} for the whole run` }
  : { ok: false, text: `fleet-tree: the tree changed during the run (${before} → ${after}); this run is void, and none of its results count` };
