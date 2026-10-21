import { createHash } from 'node:crypto';
import { appendFileSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join, matchesGlob } from 'node:path';

/** Untracked and not ignored, so `onto test` sends it with the tree and the next sync cleans it away. */
export const MARKER = '.onto/fleet-tree.json';
export const COMMIT_ENV = 'WEASEL_FLEET_COMMIT';
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

/** The marker alone, for a job that is not a vitest run and passes `COMMIT_ENV` itself (`onto do --env`). */
export const writeMarker = (tree, marker) => writeFileSync(join(tree, MARKER), `${JSON.stringify(marker, null, 1)}\n`);

/**
 * The marker says what the tree must hold, and travels with the tree. The exported commit says
 * which marker this run expects, and travels with the job: onto reads the plan here and sends its
 * script in the launch request, so a tree another run synced in between cannot supply it.
 */
export const armTree = (tree, marker) => {
  writeMarker(tree, marker);
  const plan = join(tree, PLAN);
  const gap = readFileSync(plan, 'utf8').endsWith('\n') ? '' : '\n';
  appendFileSync(plan, `${gap}prelude: export ${COMMIT_ENV}=${marker.commit}\n`);
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
  if (asked && marker.commit !== asked) {
    return { armed: true, commit: asked, checked: 0, problems: [`this tree is ${marker.commit}, and the run asked for ${asked}`] };
  }
  const entries = Object.entries(marker.files);
  const problems = entries.flatMap(([path, id]) => fileProblem(root, path, id) ?? []);
  return { armed: true, commit: marker.commit, checked: entries.length, problems };
};

/**
 * The paths a branch run limits the suite to, absolute, for vitest's `related`: what the commit
 * changes plus `always`. Undefined, so everything runs, unless the marker asks for selection and is
 * this run's, and when a changed path matches one of `triggers`.
 */
export const selection = (root, env, { always, triggers }) => {
  const at = join(root, MARKER);
  if (!existsSync(at)) return undefined;
  const marker = JSON.parse(readFileSync(at, 'utf8'));
  if (!marker.select || !env[COMMIT_ENV] || marker.commit !== env[COMMIT_ENV]) return undefined;
  const changed = Object.keys(marker.files);
  if (changed.some((path) => triggers.some((glob) => matchesGlob(path, glob)))) return undefined;
  return [...changed, ...always].map((path) => join(root, path));
};

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
