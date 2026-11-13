// Node resolves a bare specifier by walking up the tree, so a worktree nested in the main checkout
// with no install of its own runs the main checkout's vitest, vite and tsc, and reads its
// `@weasel-js/*` links and `dist`. Nothing fails; the tools test the wrong code.
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';

/** The ancestor of `root` whose `node_modules` would answer instead, or null. */
const borrowedFrom = (root) => {
  for (let dir = dirname(root); dir !== dirname(dir); dir = dirname(dir)) {
    if (existsSync(join(dir, 'node_modules'))) return dir;
  }
  return null;
};

/**
 * Why `root` cannot run its own tools, or null when it can. The workspace links `npm ci` writes
 * are the test: a `node_modules` holding only a tool's `.cache` does not count.
 * @param {string} root
 * @returns {string | null}
 */
export function ownInstallProblem(root) {
  if (existsSync(join(root, 'node_modules', '@weasel-js', 'core'))) return null;
  const other = borrowedFrom(root);
  return (
    `${root} has no install of its own` +
    (other ? `, so every tool here would resolve from ${other}/node_modules and test that checkout's packages` : '') +
    `.\nRun \`npm ci\` in ${root} first.`
  );
}

/** Throws when `root` has no install of its own: for a vite or vitest config. */
export function assertOwnInstall(root) {
  const problem = ownInstallProblem(root);
  if (problem) throw new Error(problem);
}

/** Exits 1 with the reason when `root` has no install of its own: for a script. */
export function exitUnlessOwnInstall(root) {
  const problem = ownInstallProblem(root);
  if (!problem) return;
  console.error(problem);
  process.exit(1);
}
