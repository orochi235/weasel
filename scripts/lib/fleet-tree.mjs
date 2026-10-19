import { createHash } from 'node:crypto';
import { appendFileSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

/** Untracked and not ignored, so `onto test` sends it with the tree and the next sync cleans it away. */
export const MARKER = '.onto/fleet-tree.json';
export const COMMIT_ENV = 'WEASEL_FLEET_COMMIT';
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
 * The marker says what the tree must hold, and travels with the tree. The exported commit says
 * which marker this run expects, and travels with the job: onto reads the plan here and sends its
 * script in the launch request, so a tree another run synced in between cannot supply it.
 */
export const armTree = (tree, marker) => {
  writeFileSync(join(tree, MARKER), `${JSON.stringify(marker, null, 1)}\n`);
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

/** What a fleet run prints about its tree: the line that proves the match, or why nothing else in the run counts. */
export const treeReport = (check) => check.problems.length === 0
  ? { ok: true, text: `fleet-tree: ${check.checked} changed path(s) match ${check.commit}` }
  : { ok: false, text: `this fleet run tested the wrong tree, so no other result in it counts:\n  ${check.problems.slice(0, 20).join('\n  ')}` };
