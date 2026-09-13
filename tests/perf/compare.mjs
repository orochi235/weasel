#!/usr/bin/env node
/**
 * Compare two perf result files.
 *
 *   npm run perf:compare -- <a.json> <b.json>
 *
 * Prints each item's metrics side by side with b - a and b / a, and warns when
 * the two runs' machine fingerprints differ. Exits 0 whatever the numbers say;
 * 2 on bad input.
 */
import { readFileSync } from 'node:fs';
import { validateResult } from './lib/result.ts';
import { compareResults, formatReport } from './lib/compare.ts';

const paths = process.argv.slice(2).filter((a) => a !== '--');
if (paths.length !== 2) {
  console.error('usage: npm run perf:compare -- <a.json> <b.json>');
  process.exit(2);
}

const load = (path) => {
  let parsed;
  try {
    parsed = JSON.parse(readFileSync(path, 'utf8'));
  } catch (e) {
    console.error(`${path}: ${e.message}`);
    process.exit(2);
  }
  const problems = validateResult(parsed);
  if (problems.length) {
    console.error(`${path} is not a perf result:\n  ${problems.join('\n  ')}`);
    process.exit(2);
  }
  return parsed;
};

const [a, b] = paths.map(load);
console.log(formatReport(a, b, compareResults(a, b), { a: paths[0], b: paths[1] }));
