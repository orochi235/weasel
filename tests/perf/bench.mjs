#!/usr/bin/env node
/**
 * Runs the vitest microbenchmarks in `tests/perf/bench/` and writes one result.
 *
 *   npm run perf:bench -- [--out <path>] [--raw <path>] [vitest filters, e.g. a bench file]
 *
 * `--raw` also keeps vitest's own JSON report, which `bench-report.mjs --merge` reads.
 */
import { spawnSync } from 'node:child_process';
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { DEFAULT_RESULTS_DIR, REPO_ROOT, startRun } from './lib/result.ts';
import { addVitestBench } from './lib/vitest-bench.ts';

const args = process.argv.slice(2);
let out;
let rawOut;
const filters = [];
for (let i = 0; i < args.length; i++) {
  if (args[i] === '--out') out = args[++i];
  else if (args[i] === '--raw') rawOut = resolve(args[++i]);
  else filters.push(args[i]);
}

const run = startRun('vitest-bench', { filters });
mkdirSync(DEFAULT_RESULTS_DIR, { recursive: true });
const dir = mkdtempSync(join(DEFAULT_RESULTS_DIR, '.vitest-bench-'));
try {
  const raw = join(dir, 'vitest-bench.json');
  const res = spawnSync(
    'npx',
    [
      'vitest', 'bench', '--run', '--config', 'tests/perf/vitest.bench.config.ts',
      '--reporter=default', '--reporter=json', `--outputFile.json=${raw}`, ...filters,
    ],
    { cwd: REPO_ROOT, stdio: 'inherit' },
  );
  if (res.status !== 0) {
    process.exitCode = res.status ?? 1;
  } else {
    addVitestBench(run, JSON.parse(readFileSync(raw, 'utf8')));
    if (rawOut) {
      mkdirSync(dirname(rawOut), { recursive: true });
      copyFileSync(raw, rawOut);
    }
    run.write({ out });
  }
} finally {
  rmSync(dir, { recursive: true, force: true });
}
