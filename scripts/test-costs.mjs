#!/usr/bin/env node
// Sums what `scripts/test-costs-reporter.mjs` recorded, by package: worker-seconds per package and
// project, split into import (environment, prepare, setup, collect) and test time. A browser
// project's `prepare` runs from when the file was queued, not from when a tab took it, so it is
// waiting rather than work and is left out (vitest 5.0.2; median 211 s a file on 2026-10-31).
//
//   TEST_COSTS_OUT=costs.jsonl npx vitest run --reporter=default --reporter=./scripts/test-costs-reporter.mjs
//   node scripts/test-costs.mjs costs.jsonl [--by project|package|file|module] [--project draw] [--top 40]
//
// `--by module` needs a run with `--experimental.importDurations.limit`: it sums each module's own
// import time over the files that recorded it, which only covers each file's slowest n.
import { readFileSync } from 'node:fs';
import { parseArgs } from 'node:util';

const { values, positionals } = parseArgs({
  options: {
    by: { type: 'string', default: 'package' },
    project: { type: 'string' },
    top: { type: 'string', default: '0' },
  },
  allowPositionals: true,
});

const packageOf = (file) => {
  const parts = file.split('/');
  return parts[0] === 'packages' || parts[0] === 'apps' ? `${parts[0]}/${parts[1]}` : parts[0];
};
const keyOf = {
  package: (r) => packageOf(r.file),
  project: (r) => r.project,
  file: (r) => r.file,
  module: () => undefined,
}[values.by];
if (!keyOf) throw new Error(`--by takes package, project, file or module, not ${values.by}`);

const rows = positionals
  .flatMap((path) => readFileSync(path, 'utf8').split('\n').filter(Boolean).map((line) => JSON.parse(line)))
  .filter((r) => !values.project || r.project === values.project);

if (values.by === 'module') {
  const modules = new Map();
  for (const r of rows) {
    for (const i of r.imports ?? []) {
      const m = modules.get(i.module) ?? { module: i.module, files: 0, self: 0, total: 0 };
      m.files += 1;
      m.self += i.self;
      m.total += i.total;
      modules.set(i.module, m);
    }
  }
  if (!modules.size) throw new Error('no import timings: record the run with --experimental.importDurations.limit=<n>');
  const sorted = [...modules.values()].sort((a, b) => b.self - a.self);
  const shown = Number(values.top) > 0 ? sorted.slice(0, Number(values.top)) : sorted;
  const width = Math.max('module'.length, ...shown.map((m) => m.module.length));
  console.log(`${'module'.padEnd(width)}  ${'files'.padStart(5)}  ${'self s'.padStart(8)}  ${'self ms/file'.padStart(12)}  ${'with imports ms/file'.padStart(20)}`);
  for (const m of shown) {
    console.log(
      `${m.module.padEnd(width)}  ${String(m.files).padStart(5)}  ${(m.self / 1000).toFixed(1).padStart(8)}  ${(m.self / m.files).toFixed(1).padStart(12)}  ${(m.total / m.files).toFixed(1).padStart(20)}`,
    );
  }
  process.exit(0);
}
const groups = new Map();
for (const r of rows) {
  const key = keyOf(r);
  const g = groups.get(key) ?? { key, files: 0, tests: 0, imports: 0, run: 0, projects: new Set() };
  g.files += 1;
  g.tests += r.tests;
  g.imports += r.environment + (r.project.endsWith('(chromium)') ? 0 : r.prepare) + r.setup + r.collect;
  g.run += r.run;
  g.projects.add(r.project);
  groups.set(key, g);
}

const total = [...groups.values()].reduce((sum, g) => sum + g.imports + g.run, 0);
const sorted = [...groups.values()].sort((a, b) => b.imports + b.run - (a.imports + a.run));
const shown = Number(values.top) > 0 ? sorted.slice(0, Number(values.top)) : sorted;
const width = Math.max(values.by.length, ...shown.map((g) => g.key.length));
const s = (ms) => (ms / 1000).toFixed(1).padStart(8);

console.log(
  `${values.by.padEnd(width)}  ${'files'.padStart(5)}  ${'tests'.padStart(6)}  ${'total s'.padStart(8)}  ${'share'.padStart(6)}  ${'import s'.padStart(8)}  ${'tests s'.padStart(8)}  ${'s/file'.padStart(6)}  projects`,
);
for (const g of shown) {
  const sum = g.imports + g.run;
  console.log(
    `${g.key.padEnd(width)}  ${String(g.files).padStart(5)}  ${String(g.tests).padStart(6)}  ${s(sum)}  ${((sum / total) * 100).toFixed(1).padStart(5)}%  ${s(g.imports)}  ${s(g.run)}  ${(sum / g.files / 1000).toFixed(2).padStart(6)}  ${[...g.projects].join(', ')}`,
  );
}
console.log(`${'all'.padEnd(width)}  ${String(rows.length).padStart(5)}  ${String(rows.reduce((n, r) => n + r.tests, 0)).padStart(6)}  ${s(total)}`);
