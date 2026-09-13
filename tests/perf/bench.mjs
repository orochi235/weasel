#!/usr/bin/env node
/**
 * Runs the vitest microbenchmarks in `tests/perf/bench/` and writes one result.
 *
 *   npm run perf:bench -- [--out <path>] [vitest filters, e.g. a bench file]
 */
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { DEFAULT_RESULTS_DIR, REPO_ROOT, startRun } from './lib/result.ts';
import { addVitestBench } from './lib/vitest-bench.ts';

const args = process.argv.slice(2);
let out;
const filters = [];
for (let i = 0; i < args.length; i++) {
  if (args[i] === '--out') out = args[++i];
  else filters.push(args[i]);
}

const run = startRun('vitest-bench', { filters });
mkdirSync(DEFAULT_RESULTS_DIR, { recursive: true });
const dir = mkdtempSync(join(DEFAULT_RESULTS_DIR, '.vitest-bench-'));
try {
  const raw = join(dir, 'vitest-bench.json');
  const res = spawnSync(
    'npx',
    ['vitest', 'bench', '--run', '--config', 'tests/perf/vitest.bench.config.ts', '--outputJson', raw, ...filters],
    { cwd: REPO_ROOT, stdio: 'inherit' },
  );
  if (res.status !== 0) {
    process.exitCode = res.status ?? 1;
  } else {
    addVitestBench(run, JSON.parse(readFileSync(raw, 'utf8')));
    run.write({ out });
  }
} finally {
  rmSync(dir, { recursive: true, force: true });
}
