#!/usr/bin/env node
// Merges per-source Stryker reports (mut-one.sh's output) into one mutation.json for analyze.mjs.
// Test ids are local to each run, so tests are re-keyed by file and name.
import { readdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const [dir, outPath] = process.argv.slice(2);
if (!dir || !outPath) throw new Error('usage: merge.mjs <mut-dir> <out.json>');

const testFiles = {};
const keyOf = new Map();
const files = {};
let reports = 0;
for (const name of readdirSync(dir).sort()) {
  const p = join(dir, name, 'mutation.json');
  if (!existsSync(p)) continue;
  const r = JSON.parse(readFileSync(p, 'utf8'));
  reports++;
  const local = new Map();
  for (const [file, tf] of Object.entries(r.testFiles ?? {})) {
    const into = (testFiles[file] ??= { tests: [] });
    for (const t of tf.tests) {
      const key = `${file}\u0000${t.name}`;
      if (!keyOf.has(key)) {
        keyOf.set(key, String(keyOf.size));
        into.tests.push({ id: keyOf.get(key), name: t.name });
      }
      local.set(t.id, keyOf.get(key));
    }
  }
  const map = (ids) => ids?.map((id) => local.get(id)).filter((id) => id !== undefined);
  for (const [file, f] of Object.entries(r.files)) {
    const into = (files[file] ??= { ...f, mutants: [] });
    for (const m of f.mutants) {
      into.mutants.push({ ...m, id: `${name}:${m.id}`, killedBy: map(m.killedBy), coveredBy: map(m.coveredBy) });
    }
  }
}
writeFileSync(outPath, JSON.stringify({ schemaVersion: '2', thresholds: {}, files, testFiles }));
console.log(`merged ${reports} reports: ${Object.keys(files).length} sources, ${keyOf.size} tests`);
