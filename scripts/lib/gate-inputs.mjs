/**
 * What the gate's slow checks read, so a branch run can skip one whose inputs the branch leaves alone.
 * A check not listed here always runs, and so does every check on `main`, under `--full`, and on a
 * branch that changes one of `vitest.config.ts`'s triggers. Each list is the files the check's script
 * and everything it imports read, widened to the directory where that is the honest answer.
 */
import { matchesGlob } from 'node:path';

const EVERY = ['.github/workflows/ci.yml', 'scripts/ci-checks.gate.ts', 'scripts/lib/**', 'package.json', 'package-lock.json', '**/tsconfig*.json'];

/** By the script name ci.yml runs: `changed` globs match any path the branch changes, `reshaped` only one it adds or deletes. */
export const CHECK_INPUTS = {
  'check:needs': {
    changed: ['packages/**', 'README.md', 'scripts/check-package-needs.mjs', 'scripts/package-traits.mjs', 'scripts/react-free-entries.mjs', 'scripts/readme-packages.mjs'],
  },
  // The forge app's vite config loads every story, and stories import across packages, draw and shared.
  'check:forge-stories': {
    changed: ['packages/**', 'apps/forge/**', 'apps/draw/**', 'apps/shared/**', 'assets/**', 'scripts/**'],
  },
  'check:first-publish': {
    changed: ['**/package.json', 'scripts/trust-pending.json', 'scripts/check-first-publish.mjs'],
  },
  'audit:jsdoc': {
    changed: ['packages/**', 'scripts/audit-jsdoc.mjs'],
  },
  // Which test files exist, not what they hold: a test file only edited cannot change who collects it.
  'check:test-projects': {
    changed: ['scripts/check-test-projects.mjs', '**/{vitest,vite}.config.*', 'vitest.*', 'scripts/{vite,vitest}-*', 'apps/forge/viteShared.ts'],
    reshaped: ['**/*.{test,spec}.{ts,tsx,mts,mjs,js}'],
  },
};

const hits = (paths, globs = []) => paths.find((path) => globs.some((glob) => matchesGlob(path, glob)));

/**
 * Why `script` can be skipped for these branch changes, or undefined when it has to run: always with
 * no changes (a run that tests everything), and for a script with no recorded inputs.
 */
export const skipReason = (script, changes) => {
  const inputs = CHECK_INPUTS[script];
  if (!changes || !inputs) return undefined;
  if (hits(changes.changed, [...EVERY, ...inputs.changed]) || hits(changes.reshaped, inputs.reshaped)) return undefined;
  return `the branch changes none of ${script}'s inputs`;
};
