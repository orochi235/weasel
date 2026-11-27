#!/usr/bin/env node
/**
 * Times reads of moving animation targets in plain Node, outside vitest: one target at a time
 * (`read.ts`) and as rows of a flat table (`table.ts`). Each timing does about 2e7 reads, a
 * second or two.
 *
 *   node tests/perf/target-reads/run.mjs                 # table.ts at 1,000 and 10,000 rows
 *   node tests/perf/target-reads/run.mjs table 100000
 *   node tests/perf/target-reads/run.mjs read 10000 parts
 *   node tests/perf/target-reads/run.mjs churn 10000     # stopping and starting, in parts
 *   node tests/perf/target-reads/run.mjs colors 10000   # vertex colors, resolved per node
 */
import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { cli } from '../../../scripts/lib/help.mjs';

const CASES = ['table', 'read', 'churn', 'colors'];
const { positionals } = cli(import.meta.url, {
  summary: 'Times reads of moving animation targets in plain Node, outside vitest: bundles one case and runs it once per row count.',
  positionals: `[${CASES.join('|')}] [<rows>…] [<mode>]`,
  notes: `Rows default to 1000 and 10000; a word after the case is that case's mode:
  table   idle | targets | table | held | heldfn | heldrows | behind (default table)
  read    read | readInto | parts (default read)
  churn   handle | keyed | stop (default handle)
  colors  (none)
Examples:
  node tests/perf/target-reads/run.mjs table 100000
  node tests/perf/target-reads/run.mjs read 10000 parts`,
});
const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..', '..', '..');
const [which = 'table', ...rest] = positionals;
if (!CASES.includes(which)) {
  console.error(`target-reads: no case '${which}'; one of ${CASES.join(', ')}`);
  process.exit(2);
}
const sizes = rest.filter((a) => /^\d+$/.test(a));
const args = rest.filter((a) => !/^\d+$/.test(a));

// The bundle goes to a temp directory that is removed on the way out.
const dir = mkdtempSync(join(tmpdir(), 'weasel-target-reads-'));
try {
  const out = join(dir, `${which}.mjs`);
  const built = spawnSync(join(root, 'node_modules/.bin/esbuild'), [
    join(here, `${which}.ts`), '--bundle', '--platform=node', '--format=esm',
    `--tsconfig=${join(root, 'tsconfig.json')}`, `--outfile=${out}`, '--log-level=warning',
  ], { stdio: 'inherit' });
  if (built.status !== 0) process.exit(built.status ?? 1);
  for (const n of sizes.length ? sizes : ['1000', '10000']) {
    const run = spawnSync(process.execPath, [out, ...args], { stdio: 'inherit', env: { ...process.env, N: n } });
    if (run.status !== 0) process.exit(run.status ?? 1);
  }
} finally {
  rmSync(dir, { recursive: true, force: true });
}
