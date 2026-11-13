#!/usr/bin/env node
// Reads a Stryker mutation.json (run with perTest coverage and disableBail) and reports which tests
// kill a mutant no other test kills. Writes one JSONL record per test beside the report.
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

const reportPath = process.argv[2];
if (!reportPath) throw new Error('usage: analyze.mjs <mutation.json>');
const report = JSON.parse(readFileSync(reportPath, 'utf8'));

const tests = new Map();
for (const [file, tf] of Object.entries(report.testFiles ?? {})) {
  for (const t of tf.tests) tests.set(t.id, { id: t.id, file, name: t.name, covers: 0, kills: 0, unique: 0 });
}

const status = {};
const killedSets = [];
for (const [file, f] of Object.entries(report.files)) {
  for (const m of f.mutants) {
    status[m.status] = (status[m.status] ?? 0) + 1;
    for (const id of m.coveredBy ?? []) tests.get(id) && tests.get(id).covers++;
    if (m.status !== 'Killed') continue;
    const by = m.killedBy ?? [];
    for (const id of by) tests.get(id) && tests.get(id).kills++;
    if (by.length === 1) tests.get(by[0]) && tests.get(by[0]).unique++;
    killedSets.push({ key: `${file}#${m.id}`, by });
  }
}

// Greedy set cover: the fewest tests that still kill every mutant some test kills.
const remaining = new Set(killedSets.map((_, i) => i));
const byTest = new Map();
killedSets.forEach((m, i) => m.by.forEach((id) => (byTest.get(id) ?? byTest.set(id, []).get(id)).push(i)));
const cover = [];
while (remaining.size) {
  let best = null;
  let bestGain = 0;
  for (const [id, idx] of byTest) {
    let gain = 0;
    for (const i of idx) if (remaining.has(i)) gain++;
    if (gain > bestGain) [best, bestGain] = [id, gain];
  }
  if (!best) break;
  cover.push(best);
  for (const i of byTest.get(best)) remaining.delete(i);
  byTest.delete(best);
}

// Whole-file removal: a test file is redundant if every mutant it kills is also killed outside it.
const fileOf = (id) => tests.get(id)?.file;
const fileUnique = new Map();
for (const m of killedSets) {
  const files = new Set(m.by.map(fileOf));
  if (files.size === 1) {
    const [f] = files;
    fileUnique.set(f, (fileUnique.get(f) ?? 0) + 1);
  }
}

const all = [...tests.values()];
const cls = {
  'covers no mutant': all.filter((t) => t.covers === 0),
  'covers, kills none': all.filter((t) => t.covers > 0 && t.kills === 0),
  'kills, none unique': all.filter((t) => t.kills > 0 && t.unique === 0),
  'kills a unique mutant': all.filter((t) => t.unique > 0),
};
const testFiles = Object.keys(report.testFiles ?? {});
const redundantFiles = testFiles.filter((f) => !fileUnique.get(f));

const out = dirname(reportPath);
writeFileSync(join(out, 'tests.jsonl'), all.map((t) => JSON.stringify({ ...t, inCover: cover.includes(t.id) })).join('\n') + '\n');
writeFileSync(join(out, 'redundant-files.txt'), redundantFiles.sort().join('\n') + '\n');

const w = String(Math.max(all.length, killedSets.length)).length;
const row = (label, n, d) => `  ${label.padEnd(26)} ${String(n).padStart(w)}  ${((100 * n) / d).toFixed(1).padStart(5)}%`;
console.log('mutants');
for (const [s, n] of Object.entries(status).sort((a, b) => b[1] - a[1])) console.log(row(s, n, Object.values(status).reduce((a, b) => a + b)));
console.log(`tests (${all.length})`);
for (const [label, list] of Object.entries(cls)) console.log(row(label, list.length, all.length));
console.log(row('minimal killing set', cover.length, all.length));
console.log(`test files (${testFiles.length})`);
console.log(row('no unique kill', redundantFiles.length, testFiles.length));
