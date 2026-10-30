// The `browser` vitest project alone, with the workspace packages served from source and served pre-bundled
// (`scripts/vite-prebundle.ts`), alternating so both see the node as it is. Every run's whole log, its JSON report
// and one line of its numbers go to --out as the run finishes.
//
//   node scripts/bench-browser-project.mjs --node teitou --variants source,bundled --reps 3 --out .bench/browser-project
import { spawn } from 'node:child_process';
import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { cpus, hostname } from 'node:os';
import { join } from 'node:path';
import { parseArgs } from 'node:util';
import { sampleLoad } from './lib/node-load.mjs';

const { values } = parseArgs({
  options: {
    variants: { type: 'string', default: 'source,bundled' },
    reps: { type: 'string', default: '1' },
    node: { type: 'string', default: hostname().split('.')[0] },
    out: { type: 'string', default: '.bench/browser-project' },
  },
});
const variants = values.variants.split(',');
const reps = Number(values.reps);
const cores = cpus().length;
const node = values.node;
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

/** Per file: how long it took from start to end, and its tests' own time, from vitest's JSON report. */
function files(report) {
  if (!existsSync(report)) return null;
  const { testResults, numPassedTests, numFailedTests, numPendingTests } = JSON.parse(readFileSync(report, 'utf8'));
  const spans = testResults.map((f) => (f.endTime - f.startTime) / 1000);
  const tests = testResults.map((f) => f.assertionResults.reduce((s, t) => s + (t.duration ?? 0), 0) / 1000);
  const sum = (xs) => xs.reduce((a, b) => a + b, 0);
  return {
    files: testResults.length,
    passed: numPassedTests,
    failed: numFailedTests,
    skipped: numPendingTests,
    fileSpanSeconds: sum(spans),
    testSeconds: sum(tests),
    failedFiles: testResults.filter((f) => f.status !== 'passed').map((f) => f.name.replace(process.cwd() + '/', '')),
  };
}

const trial = (variant, id) =>
  new Promise((resolve) => {
    const started = Date.now();
    const log = join(values.out, `${id}.log`);
    const report = join(values.out, `${id}.json`);
    const env = { ...process.env, FORCE_COLOR: '0', NO_COLOR: '1', WEASEL_DEV_SOURCE: variant === 'source' ? '1' : '0' };
    const args = ['node_modules/vitest/vitest.mjs', 'run', '--project=browser', '--reporter=default', '--reporter=json', `--outputFile.json=${report}`];
    const child = spawn(process.execPath, args, { env, stdio: ['ignore', 'pipe', 'pipe'] });
    let text = '';
    const take = (d) => {
      text += d;
      appendFileSync(log, d);
    };
    child.stdout.on('data', take);
    child.stderr.on('data', take);
    child.on('close', (code) => {
      resolve({
        code,
        wallSeconds: (Date.now() - started) / 1000,
        reoptimized: (text.match(/Re-optimizing dependencies/g) ?? []).length,
        ...phases(text),
        ...files(report),
      });
    });
  });

const total = variants.length * reps;
let n = 0;
for (let rep = 1; rep <= reps; rep++) {
  for (const variant of variants) {
    n++;
    const id = `${node}-${variant}-rep${rep}`;
    const before = await sampleLoad();
    const r = await trial(variant, id);
    const row = { node, cores, variant, rep, at: new Date().toISOString(), loadBefore: before, ...r };
    appendFileSync(join(values.out, 'runs.jsonl'), JSON.stringify(row) + '\n');
    console.log(
      `${String(n).padStart(2)}/${total}  ${node}  ${variant.padEnd(7)}  rep ${rep}  ` +
        `${r.wallSeconds.toFixed(1).padStart(6)}s wall  ${(r.fileSpanSeconds ?? 0).toFixed(1).padStart(6)}s in files  ` +
        `${(r.testSeconds ?? 0).toFixed(1).padStart(6)}s in tests  failed ${String(r.failed ?? '?').padStart(3)}  ` +
        `busy before ${before.busy.toFixed(1).padStart(4)}  exit ${r.code}`,
    );
  }
}
writeFileSync(join(values.out, `${node}-done`), `${n} runs\n`);
