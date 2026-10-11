#!/usr/bin/env node
/**
 * Compare two perf result files, or two directories of them.
 *
 *   npm run perf:compare -- <a.json> <b.json>
 *   npm run perf:compare -- <a-dir> <b-dir>
 *
 * Prints each item's metrics side by side with b - a and b / a, and warns when
 * the two runs' machine fingerprints differ. Two directories are matched by
 * benchmark, one report each, taking the latest file where a side holds a
 * benchmark more than once. Exits 0 whatever the numbers say; 2 on bad input.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { validateResult } from './lib/result.ts';
import { compareResults, formatReport } from './lib/compare.ts';
import { pairByBenchmark } from './lib/pairResults.ts';

const paths = process.argv.slice(2).filter((a) => a !== '--');
if (paths.length !== 2) {
  console.error('usage: npm run perf:compare -- <a.json|a-dir> <b.json|b-dir>');
  process.exit(2);
}

const fail = (message) => {
  console.error(message);
  process.exit(2);
};

const load = (path) => {
  let parsed;
  try {
    parsed = JSON.parse(readFileSync(path, 'utf8'));
  } catch (e) {
    fail(`${path}: ${e.message}`);
  }
  const problems = validateResult(parsed);
  if (problems.length) fail(`${path} is not a perf result:\n  ${problems.join('\n  ')}`);
  return parsed;
};

const isDir = (path) => {
  try {
    return statSync(path).isDirectory();
  } catch (e) {
    return fail(`${path}: ${e.message}`);
  }
};

const loadDir = (dir) =>
  readdirSync(dir)
    .filter((name) => name.endsWith('.json'))
    .sort()
    .map((name) => join(dir, name))
    .map((path) => ({ path, result: load(path) }));

const report = (a, b) =>
  formatReport(a.result, b.result, compareResults(a.result, b.result), { a: a.path, b: b.path });

const dirs = paths.map(isDir);
if (dirs[0] !== dirs[1]) fail('give two result files or two directories, not one of each');

if (!dirs[0]) {
  const [a, b] = paths.map((path) => ({ path, result: load(path) }));
  console.log(report(a, b));
} else {
  const { pairs, onlyA, onlyB } = pairByBenchmark(loadDir(paths[0]), loadDir(paths[1]));
  for (const pair of pairs) console.log(`${report(pair.a, pair.b)}\n`);
  if (onlyA.length) console.log(`only in ${paths[0]}: ${onlyA.join(', ')}`);
  if (onlyB.length) console.log(`only in ${paths[1]}: ${onlyB.join(', ')}`);
  if (pairs.length === 0) console.log('no benchmark has a result on both sides');
}
