#!/usr/bin/env node
/**
 * The node-side half of `scripts/fleet-ci.mjs`: from a clean install, ci.yml's steps on the Node it
 * runs under, one line per step as it finishes — its first build and every step after it, or with
 * `job` the whole job. Not for a checkout anyone works in — it deletes the ignored build output
 * under packages/ and apps/ first, so a `dist` left by an earlier run cannot supply a file the build
 * no longer emits — and it refuses to start in a tree `fleet-ci.mjs` did not arm.
 */
import { execFileSync, spawn } from 'node:child_process';
import { existsSync, readdirSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { delimiter, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { calibrate, createBar, planWeights, readWeights, writeWeights } from './lib/ci-progress.mjs';
import { CI_YML, builtSteps, jobSteps, readCi } from './lib/ci-steps.mjs';
import { COMMIT_ENV, checkTree, stampReport, stepEnv, treeReport, treeStamp } from './lib/fleet-tree.mjs';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const TAIL = 80;
const say = (line) => console.log(`ci-run: ${line}`);
const mode = process.argv[2] ?? 'built';
if (mode === '--calibrate') {
  const log = process.argv[3];
  if (!log) {
    say('usage: ci-run.mjs --calibrate <log>');
    process.exit(2);
  }
  const before = readWeights();
  const after = calibrate(before, readFileSync(log === '-' ? 0 : log, 'utf8'));
  for (const [label, secs] of Object.entries(after)) {
    if (before[label] !== secs) say(`${String(before[label] ?? '-').padStart(7)} -> ${secs.toFixed(1).padStart(7)}s  ${label}`);
  }
  writeWeights(after);
  process.exit(0);
}
if (mode !== 'built' && mode !== 'job') {
  say(`unknown mode "${mode}": built or job`);
  process.exit(2);
}

const check = checkTree(ROOT, process.env);
if (!check.armed) {
  say(`refusing: this tree was not armed by fleet-ci.mjs (no ${COMMIT_ENV}). Run npm run test:fleet:postbuild or test:fleet:matrix.`);
  process.exit(2);
}
const tree = treeReport(check);
say(tree.text);
if (!tree.ok) process.exit(1);
const stamp = treeStamp(ROOT);

const { env: jobEnv, steps } = readCi(readFileSync(CI_YML, 'utf8'));
const nodeMajor = Number(process.versions.node.split('.')[0]);
const plan = mode === 'job' ? jobSteps(steps, nodeMajor) : [{ run: 'npm ci', env: {} }, ...builtSteps(steps, nodeMajor)];
const labels = plan.map((step) => step.run.replace(/\n/g, ' && '));
const weights = planWeights(labels, readWeights());

// The job's stdout, which onto reads protocol lines from in a `do` job's log. Not fd 3, as
// vitest-overlap.mjs uses: that is onto adapt's channel, and in a `do` job fd 3 is open to
// something that refuses writes (ENXIO).
const toOnto = (line) => console.log(line);
const bar = createBar(weights, toOnto);
bar.start();
const started = Date.now();

// CI installs its pinned npm globally; here it goes in a per-version directory under the OS temp dir,
// and every other version's directory is deleted, so at most one is ever kept.
const npmBin = (version) => {
  const home = join(tmpdir(), 'weasel-ci-npm');
  const prefix = join(home, version);
  for (const old of existsSync(home) ? readdirSync(home) : []) if (old !== version) rmSync(join(home, old), { recursive: true, force: true });
  // An interrupted install leaves bin/npm without its lib, so ask the copy itself whether it runs.
  const runs = () => {
    try {
      return execFileSync(join(prefix, 'bin', 'npm'), ['--version'], { encoding: 'utf8' }).trim() === version;
    } catch {
      return false;
    }
  };
  if (!runs()) {
    rmSync(prefix, { recursive: true, force: true });
    execFileSync('npm', ['install', '--global', '--prefix', prefix, '--no-audit', '--no-fund', `npm@${version}`], { stdio: 'ignore' });
  }
  return join(prefix, 'bin');
};

const baseEnv = stepEnv(process.env);
const PATH = jobEnv.NPM_VERSION ? [npmBin(jobEnv.NPM_VERSION), baseEnv.PATH].join(delimiter) : baseEnv.PATH;
const env = { ...baseEnv, ...jobEnv, PATH };
say(`node ${process.versions.node}, npm ${execFileSync('npm', ['--version'], { env, encoding: 'utf8' }).trim()}`);

for (const dir of ['packages', 'apps']) execFileSync('git', ['clean', '-fdXq', '--', dir], { cwd: ROOT });
for (const name of readdirSync(ROOT)) if (/^dist(-|$)/.test(name)) rmSync(join(ROOT, name), { recursive: true, force: true });

/** Runs one step as GitHub's `bash -e` would, its output kept to show only if it fails. */
const runStep = (run, stepEnv) =>
  new Promise((done) => {
    const child = spawn('bash', ['-e', '-c', run], { cwd: ROOT, env: { ...env, ...stepEnv }, stdio: ['ignore', 'pipe', 'pipe'] });
    const chunks = [];
    child.stdout.on('data', (chunk) => chunks.push(chunk));
    child.stderr.on('data', (chunk) => chunks.push(chunk));
    child.on('error', (error) => done({ ok: false, output: String(error) }));
    child.on('close', (status) => done({ ok: status === 0, output: Buffer.concat(chunks).toString('utf8') }));
  });

const width = String(plan.length).length;
const secs = (s) => `${s.toFixed(1).padStart(7)}s`;
let failed = 0;
let broken = '';
say(`setup took ${((Date.now() - started) / 1000).toFixed(1)}s; plan ${bar.total}s over ${plan.length} steps`);
for (const [i, step] of plan.entries()) {
  const label = labels[i];
  const at = `${String(i + 1).padStart(width)}/${plan.length}`;
  const planned = secs(weights[i]).trim();
  if (broken) {
    bar.skip(i);
    say(`${at} skip           (plan ${planned.padStart(7)})  ${label}  (after ${broken} failed)`);
    continue;
  }
  const t0 = Date.now();
  bar.begin(i);
  const { ok, output } = await runStep(step.run, step.env);
  bar.end(i);
  const took = (Date.now() - t0) / 1000;
  say(`${at} ${ok ? 'ok  ' : 'FAIL'} ${secs(took)}  (plan ${planned.padStart(7)}, ${(took / weights[i]).toFixed(2).padStart(5)}×)  ${label}`);
  if (ok) continue;
  failed++;
  const lines = output.trimEnd().split('\n');
  console.log(lines.slice(-TAIL).map((line) => `    ${line}`).join('\n'));
  // Every later step reads what a build or an install writes.
  if (/^npm (ci|run build)\b/.test(step.run)) broken = label;
}

const score = bar.finish();
say(`bar strayed ${score.mean.toFixed(1)} points on average from a perfectly paced one, ${score.worst.toFixed(1)} at worst`);
const end = stampReport(stamp, treeStamp(ROOT));
say(end.text);
say(`${failed ? `${failed} step(s) failed` : 'every step passed'} in ${((Date.now() - started) / 60000).toFixed(1)} min`);
process.exit(failed || !end.ok ? 1 : 0);
