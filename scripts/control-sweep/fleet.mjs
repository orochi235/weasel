/**
 * Sending the control sweep to a fleet node with a browser, shared by `npm run sweep:controls` and
 * the nightly run. onto brings `--out` back only when the job succeeds, so the job records the
 * sweep's exit code in the run directory and exits 0 itself.
 */
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

/** Where the sweep writes on the node, relative to that tree. */
export const NODE_OUT = '.control-sweep';
export const EXPECT = '30m';
export const TIMEOUT = '90m';

const q = (s) => `'${String(s).replace(/'/g, `'\\''`)}'`;
const NVM = 'export NVM_DIR="${NVM_DIR:-$HOME/.nvm}"; . "$NVM_DIR/nvm.sh" >/dev/null; nvm use >/dev/null';

/**
 * The job's shell: install when the lockfile changed since the tree's last install (CI's way, scripts
 * skipped; the sweep builds what it needs), make sure Playwright's Chromium is there, run the sweep.
 */
export const sweepShell = (run, sweepArgs = []) => [
  'set -e', NVM,
  'cmp -s package-lock.json node_modules/.control-sweep-lock || (npm ci --ignore-scripts --no-audit --no-fund && cp package-lock.json node_modules/.control-sweep-lock)',
  'npx playwright install chromium >/dev/null',
  `mkdir -p ${NODE_OUT}/${run}`,
  'set +e',
  `node scripts/control-sweep.mjs --out ${NODE_OUT} --run ${q(run)} ${sweepArgs.map(q).join(' ')}`,
  `echo $? > ${NODE_OUT}/${run}/exit`,
  'exit 0',
].join('\n');

/**
 * `onto do`'s arguments for one sweep, its output brought into `to`. Without `tree` it runs in one of the node's pooled
 * trees, so onto can place it on any node with room: a named tree only exists where a sweep ran before.
 */
export const ontoArgs = ({ run, to, task, about, ref, node, tree, sweepArgs = [] }) => [
  'do', '--gui', '--kind', 'test', '--icon', 'slider.horizontal.3', ...(tree ? ['--in', tree] : []), '--force',
  ...(ref ? ['--ref', ref] : []), ...(node ? ['--node', node] : []),
  '--task', task, '--about', about, '--expect', EXPECT, '--timeout', TIMEOUT,
  '--out', `${NODE_OUT}/${run}`, '--to', to,
  '--', 'bash', '-lc', sweepShell(run, sweepArgs),
];

/** What a finished job left in `to`: the sweep's exit code (undefined when it never ran) and its summary. */
export const readRun = (to) => {
  const exitFile = join(to, 'exit');
  const summaryFile = join(to, 'summary.json');
  return {
    exit: existsSync(exitFile) ? Number(readFileSync(exitFile, 'utf8').trim()) : undefined,
    summary: existsSync(summaryFile) ? JSON.parse(readFileSync(summaryFile, 'utf8')) : undefined,
  };
};
