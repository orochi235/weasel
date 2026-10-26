/**
 * Read perf result files from disk, validated, for the scripts that compare
 * them (`compare.mjs`, `pr-comment.mjs`).
 */
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { type PerfResult, validateResult } from './result.ts';
import type { ResultFile } from './pairResults.ts';

/** Throws, naming the file, on JSON that does not parse or is not a perf result. */
export function loadResult(path: string): PerfResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(readFileSync(path, 'utf8'));
  } catch (e) {
    throw new Error(`${path}: ${(e as Error).message}`);
  }
  const problems = validateResult(parsed);
  if (problems.length) throw new Error(`${path} is not a perf result:\n  ${problems.join('\n  ')}`);
  return parsed as PerfResult;
}

/** Every `.json` file directly in `dir`, in name order. */
export function loadResultDir(dir: string): ResultFile[] {
  return readdirSync(dir)
    .filter((name) => name.endsWith('.json'))
    .sort()
    .map((name) => join(dir, name))
    .map((path) => ({ path, result: loadResult(path) }));
}
