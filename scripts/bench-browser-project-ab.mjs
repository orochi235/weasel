#!/usr/bin/env node
// The `browser` project alone, alternating between HEAD's files ("before") and the tree's uncommitted edits
// ("after"), each state with its own vite cache: a warm-up of each, then three runs of each. Rows go to
// .bench/browser-ab/runs.jsonl, `rep` 0 being the warm-up; append them to scripts/bench-browser-project.runs.jsonl.
//
//   onto do --kind bench --task <name> --node teitou --solo --expect 25m --timeout 50m \
//     --out .bench/browser-ab -- node scripts/bench-browser-project-ab.mjs
import { execFileSync, spawnSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, readFileSync, renameSync, rmSync, statSync, utimesSync, writeFileSync } from 'node:fs';
import { hostname } from 'node:os';
import { dirname } from 'node:path';
import { cli } from './lib/help.mjs';

cli(import.meta.url, {
  summary: "Times the `browser` project alone, alternating between HEAD's files and the tree's uncommitted edits, each with its own vite cache: a warm-up of each, then three runs of each. Rows go to .bench/browser-ab/runs.jsonl.",
});

const node = hostname().split('.')[0];
const out = '.bench/browser-ab';
const A = '.bench/ab';
const git = (...args) => execFileSync('git', args, { encoding: 'utf8' });

// Edits, files added (untracked ones too) and files removed, each named by its own path.
const files = [...new Set([...git('diff', '--name-only', '--no-renames', 'HEAD').split('\n'), ...git('ls-files', '--others', '--exclude-standard').split('\n')])]
  .filter((f) => f && !f.startsWith('scripts/bench-browser-project') && !/^\.[^/]*$/.test(f))
  .sort();
console.log(`${files.length} files differ`);
rmSync(A, { recursive: true, force: true });
rmSync(out, { recursive: true, force: true });
for (const dir of [`${A}/after`, `${A}/before`, out]) mkdirSync(dir, { recursive: true });
for (const f of files) {
  mkdirSync(dirname(`${A}/after/${f}`), { recursive: true });
  mkdirSync(dirname(`${A}/before/${f}`), { recursive: true });
  if (existsSync(f)) cpSync(f, `${A}/after/${f}`, { preserveTimestamps: true });
  if (spawnSync('git', ['cat-file', '-e', `HEAD:${f}`], { stdio: 'ignore' }).status === 0) {
    writeFileSync(`${A}/before/${f}`, execFileSync('git', ['show', `HEAD:${f}`], { maxBuffer: 1 << 28 }));
    // The prebundle re-bundles on a bundled file's mtime, so each state keeps one.
    if (existsSync(f)) {
      const { atime, mtime } = statSync(f);
      utimesSync(`${A}/before/${f}`, atime, mtime);
    }
  }
}

let cur = 'after';
const use = (state) => {
  for (const f of files) {
    if (existsSync(`${A}/${state}/${f}`)) {
      mkdirSync(dirname(f), { recursive: true });
      cpSync(`${A}/${state}/${f}`, f, { preserveTimestamps: true });
    } else rmSync(f, { force: true });
  }
  const cache = 'node_modules/.vite-browser';
  if (existsSync(cache)) {
    rmSync(`${cache}-${cur}`, { recursive: true, force: true });
    renameSync(cache, `${cache}-${cur}`);
  }
  if (existsSync(`${cache}-${state}`)) renameSync(`${cache}-${state}`, cache);
  cur = state;
};

const REPS = [0, 1, 2, 3];
for (const r of REPS) {
  for (const state of ['before', 'after']) {
    use(state);
    execFileSync(process.execPath, ['scripts/bench-browser-project.mjs', '--node', node, '--variants', 'bundled', '--reps', '1', '--label', state,
      '--out', `${out}/r${r}`], { stdio: 'inherit' });
  }
}
use('after');
const rows = REPS.map((r) => readFileSync(`${out}/r${r}/runs.jsonl`, 'utf8').split('\n').map((line) => line.replace('"rep":1,', `"rep":${r},`)).join('\n'));
writeFileSync(`${out}/runs.jsonl`, rows.join(''));
