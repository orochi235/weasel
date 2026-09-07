#!/usr/bin/env node
/**
 * Every vitest file in the tree must be claimed by a project `npm test` runs.
 *
 * The projects each own an include glob, so a test file in a directory no glob
 * reaches is collected by nobody: it does not run, and nothing says so. Two
 * agents in the 2026-08-22 review pass read a green `test:core` as "the kit
 * passes", and one nearly wrote tests under a package that project never
 * globs.
 *
 * The claim comes from vitest itself (`vitest list --filesOnly`), for the
 * projects named in package.json's `test` script, so this checks the command
 * people actually run rather than a second copy of the globs.
 */

import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));

/** Suites run by another runner, and the config that runs them. */
const NOT_VITEST = [
  ['tests/visual/', 'playwright — npm run test:visual'],
  ['tests/e2e/', 'playwright — npm run test:e2e:demos (helpers/ are vitest and stay in scope)'],
  ['tests/perf/', 'playwright — npm run test:perf'],
  ['apps/draw/tests-e2e/', 'playwright — npm run test:e2e:draw'],
];

const isVitestFile = (path) => {
  if (!/\.(test|spec)\.(ts|tsx|mts|mjs|js)$/.test(path)) return false;
  return !NOT_VITEST.some(
    ([prefix]) => path.startsWith(prefix) && !path.startsWith('tests/e2e/helpers/'),
  );
};

const git = (...args) => execFileSync('git', args, { cwd: ROOT, encoding: 'utf8' });

const projectsInTestScript = () => {
  const { scripts } = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
  const names = [...(scripts?.test ?? '').matchAll(/--project=([\w-]+)/g)].map((m) => m[1]);
  if (names.length === 0) {
    console.error('check:test-projects — package.json\'s `test` script names no --project.');
    process.exit(1);
  }
  return names;
};

const claimed = (projects) => {
  const out = execFileSync(
    'npx',
    ['vitest', 'list', '--filesOnly', ...projects.map((p) => `--project=${p}`)],
    { cwd: ROOT, encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 },
  );
  const byFile = new Map();
  for (const line of out.split('\n')) {
    const match = /^\[([\w-]+)]\s+(.+)$/.exec(line.trim());
    if (!match) continue;
    const [, project, file] = match;
    if (!byFile.has(file)) byFile.set(file, new Set());
    byFile.get(file).add(project);
  }
  return byFile;
};

const projects = projectsInTestScript();
const byFile = claimed(projects);
const tracked = git('ls-files').split('\n').filter(isVitestFile);

const orphans = tracked.filter((f) => !byFile.has(f));
if (orphans.length > 0) {
  console.error(
    `check:test-projects — ${orphans.length} test file(s) no project collects, so they never run:\n` +
      orphans.map((f) => `  ${f}`).join('\n') +
      `\n\nProjects \`npm test\` runs: ${projects.join(', ')}.\n` +
      'Widen one project\'s `include` in vitest.config.ts, or add a project.\n' +
      'A suite that is deliberately run by another runner belongs in this\n' +
      "script's NOT_VITEST list, with the command that runs it.",
  );
  process.exit(1);
}

// The reverse mapping is the thing that was hard to see: which project runs a
// given package's tests. Printing it makes `test:core` covers what? a
// one-command question.
const perDir = new Map();
for (const [file, owners] of byFile) {
  const dir = file.split('/').slice(0, 2).join('/');
  if (!perDir.has(dir)) perDir.set(dir, { files: 0, owners: new Set() });
  const entry = perDir.get(dir);
  entry.files += 1;
  for (const owner of owners) entry.owners.add(owner);
}
const width = Math.max(...[...perDir.keys()].map((d) => d.length));
for (const dir of [...perDir.keys()].sort()) {
  const { files, owners } = perDir.get(dir);
  console.log(`  ${dir.padEnd(width)}  ${[...owners].sort().join(', ')}  (${files})`);
}
console.log(`test projects: all ${tracked.length} vitest files are collected by \`npm test\`.`);
