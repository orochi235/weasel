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
import { cli } from '../../scripts/lib/help.mjs';

const { values, positionals, rest } = cli(import.meta.url, {
  summary: 'Runs the vitest microbenchmarks in tests/perf/bench/ and writes one perf result file.',
  positionals: '[<vitest filter>…]',
  passthrough: true,
  options: {
    out: { type: 'string', placeholder: '<path>', description: 'where the result goes (default: under tests/perf/results/)' },
    raw: { type: 'string', placeholder: '<path>', description: "also keep vitest's own JSON report, which `bench-report.mjs --merge` reads" },
  },
  notes: 'Positionals and any other flag go to `vitest bench`. Run it as `npm run perf:bench -- …`.',
});
const out = values.out;
const rawOut = values.raw === undefined ? undefined : resolve(values.raw);
const filters = [...positionals, ...rest];

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
