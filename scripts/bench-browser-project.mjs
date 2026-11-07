// The `browser` vitest project alone, with the workspace packages served from source and served pre-bundled
// (`scripts/vite-prebundle.ts`), alternating so both see the node as it is. Every run's whole log, its JSON report
// and one line of its numbers go to --out as the run finishes.
//
//   node scripts/bench-browser-project.mjs --node teitou --variants source,bundled --reps 3 --out .bench/browser-project
//
// `--files` passes vitest file filters, to time one package's tests; `--label` names what the tree held, for a
// comparison between two trees rather than two variants (the caller swaps the tree between runs). `--processes 1,2,3`
// also splits the project across that many concurrent vitest processes, each its own Chromium running `--shard=i/N`
// with the project's six tabs (`--tabs` for another count), and times the run to the last one finishing.
// `--split hash,duration` alternates how those processes divide the files: vitest's count-based `--shard`, or
// the durations its results cache last recorded (`scripts/vitest-duration-sequencer.ts`).
import { spawn } from 'node:child_process';
import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { cpus, hostname } from 'node:os';
import { join } from 'node:path';
import { parseArgs } from 'node:util';
import { DURATIONS_ENV, durationsEnv } from './lib/browser-shards.mjs';
import { sampleLoad } from './lib/node-load.mjs';

const { values } = parseArgs({
  options: {
    variants: { type: 'string', default: 'source,bundled' },
    reps: { type: 'string', default: '1' },
    node: { type: 'string', default: hostname().split('.')[0] },
    out: { type: 'string', default: '.bench/browser-project' },
    files: { type: 'string', default: '' },
    label: { type: 'string', default: '' },
    processes: { type: 'string', default: '1' },
    tabs: { type: 'string', default: '6' },
    split: { type: 'string', default: 'hash' },
  },
});
const variants = values.variants.split(',');
const reps = Number(values.reps);
const cores = cpus().length;
const node = values.node;
const filters = values.files ? values.files.split(',') : [];
const label = values.label || undefined;
const splits = values.processes.split(',').map(Number);
const TABS = Number(values.tabs);
const splitsBy = values.split.split(',');
mkdirSync(values.out, { recursive: true });

/** vitest's summary, `Duration 6.82s (worker 50%, import 32%, tests 16%, setup 3%)`: its wall time and each phase's share. */
function phases(text) {
  const m = /Duration\s+([\d.]+)(m?s)\s+\(([^)]*)\)/.exec(text);
  if (!m) return {};
  const share = {};
  for (const part of m[3].split(',')) {
    const p = /(\w+)\s+([\d.]+)%/.exec(part.trim());
    if (p) share[p[1]] = Number(p[2]) / 100;
  }
  return { durationSeconds: m[2] === 'ms' ? Number(m[1]) / 1000 : Number(m[1]), phaseShare: share };
}

/** From vitest's JSON reports, one per process, whose per-file times start at the first test, so a file's page and module load is in neither. */
function files(reports) {
  const read = reports.filter((r) => existsSync(r)).map((r) => JSON.parse(readFileSync(r, 'utf8')));
  if (read.length < reports.length) return { missingReports: reports.length - read.length };
  const testResults = read.flatMap((r) => r.testResults);
  const count = (k) => read.reduce((s, r) => s + r[k], 0);
  const [numPassedTests, numFailedTests, numPendingTests] = ['numPassedTests', 'numFailedTests', 'numPendingTests'].map(count);
  const spans = testResults.map((f) => (f.endTime - f.startTime) / 1000);
  const tests = testResults.map((f) => f.assertionResults.reduce((s, t) => s + (t.duration ?? 0), 0) / 1000);
  const sum = (xs) => xs.reduce((a, b) => a + b, 0);
  return {
    files: testResults.length,
    passed: numPassedTests,
    failed: numFailedTests,
    skipped: numPendingTests,
    testSpanSeconds: sum(spans),
    testSeconds: sum(tests),
    failedFiles: testResults.filter((f) => f.status !== 'passed').map((f) => f.name.replace(process.cwd() + '/', '')),
  };
}

/** One vitest process: shard `i` of `of`, or the whole project when `of` is 1. */
const shard = (variant, id, i, of, started, splitEnv) =>
  new Promise((resolve) => {
    const name = of === 1 ? id : `${id}-shard${i}`;
    const log = join(values.out, `${name}.log`);
    const report = join(values.out, `${name}.json`);
    const env = { ...process.env, FORCE_COLOR: '0', NO_COLOR: '1', WEASEL_DEV_SOURCE: variant === 'source' ? '1' : '0', WEASEL_BROWSER_TABS: String(TABS), ...splitEnv };
    if (!splitEnv[DURATIONS_ENV]) delete env[DURATIONS_ENV];
    const args = ['node_modules/vitest/vitest.mjs', 'run', '--project=browser', '--reporter=default', '--reporter=json', `--outputFile.json=${report}`, ...(of > 1 ? [`--shard=${i}/${of}`] : []), ...filters];
    const child = spawn(process.execPath, args, { env, stdio: ['ignore', 'pipe', 'pipe'] });
    let text = '';
    const take = (d) => {
      text += d;
      appendFileSync(log, d);
    };
    child.stdout.on('data', take);
    child.stderr.on('data', take);
    child.on('close', (code) => resolve({ code, report, wallSeconds: (Date.now() - started) / 1000, text }));
  });

const trial = async (variant, id, of, by) => {
  // One snapshot for every process, taken before any of them updates the cache.
  const splitEnv = of > 1 && by === 'duration' ? durationsEnv(process.cwd(), {}) : {};
  const recorded = splitEnv[DURATIONS_ENV] ? Object.keys(JSON.parse(splitEnv[DURATIONS_ENV])).length : undefined;
  const started = Date.now();
  const runs = await Promise.all(Array.from({ length: of }, (_, k) => shard(variant, id, k + 1, of, started, splitEnv)));
  const text = runs.map((r) => r.text).join('\n');
  return {
    code: runs.find((r) => r.code !== 0)?.code ?? 0,
    wallSeconds: Math.max(...runs.map((r) => r.wallSeconds)),
    ...(of > 1 && {
      processWallSeconds: runs.map((r) => r.wallSeconds),
      processPhases: runs.map((r) => phases(r.text)),
      split: by,
      ...(recorded !== undefined && { recordedFiles: recorded }),
      sliceLines: runs.map((r) => /duration-sequencer: .*/.exec(r.text)?.[0]).filter(Boolean),
    }),
    reoptimized: (text.match(/Re-optimizing dependencies/g) ?? []).length,
    ...(of === 1 && phases(text)),
    ...files(runs.map((r) => r.report)),
  };
};

const total = variants.length * splits.reduce((s, of) => s + (of > 1 ? splitsBy.length : 1), 0) * reps;
let n = 0;
for (let rep = 1; rep <= reps; rep++) {
  for (const variant of variants) {
    for (const of of splits) for (const by of of > 1 ? splitsBy : ['hash']) {
      n++;
      const id = `${node}-${label ? `${label}-` : ''}${variant}-${of > 1 ? `p${of}-${by}-` : ''}${TABS !== 6 ? `t${TABS}-` : ''}rep${rep}`;
      const before = await sampleLoad();
      const r = await trial(variant, id, of, by);
      // maxWorkers is the project's, per process, so workerSeconds is what the run held: tabs × wall.
      const tabs = TABS * of;
      const row = { node, cores, maxWorkers: TABS, processes: of, workerSeconds: tabs * r.wallSeconds, variant, ...(label && { label }), ...(filters.length && { filters }), rep, at: new Date().toISOString(), loadBefore: before, ...r };
      appendFileSync(join(values.out, 'runs.jsonl'), JSON.stringify(row) + '\n');
      console.log(
        `${String(n).padStart(2)}/${total}  ${node}  ${variant.padEnd(7)}  ${of} proc × ${String(TABS).padStart(2)} tabs  rep ${rep}  ` +
          `${label ? `${label.padEnd(6)}  ` : ""}${of > 1 ? `${by.padEnd(8)}  ` : ''}${r.wallSeconds.toFixed(1).padStart(6)}s wall  ${(tabs * r.wallSeconds).toFixed(1).padStart(6)} worker-s  ` +
          `${r.processWallSeconds ? `slices ${r.processWallSeconds.map((w) => w.toFixed(1).padStart(6)).join(' ')}  ` : ''}` +
          `${(r.testSeconds ?? 0).toFixed(1).padStart(6)}s in tests  files ${String(r.files ?? '?').padStart(3)}  failed ${String(r.failed ?? '?').padStart(3)}  ` +
          `busy before ${before.busy.toFixed(1).padStart(4)}  exit ${r.code}`,
      );
    }
  }
}
writeFileSync(join(values.out, `${node}-done`), `${n} runs\n`);
