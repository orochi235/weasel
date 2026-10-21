#!/usr/bin/env node
/**
 * The node-side half of `npm run test:fleet:postbuild`: from a clean install, ci.yml's first build
 * and every step after it, one line per step as it finishes. Not for a checkout anyone works in —
 * it deletes the ignored build output under packages/ and apps/ first, so a `dist` left by an
 * earlier run cannot supply a file the build no longer emits — and it refuses to start in a tree
 * `fleet-postbuild.mjs` did not arm.
 */
import { execFileSync, spawn } from 'node:child_process';
import { existsSync, readdirSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { delimiter, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { CI_YML, builtSteps, readCi } from './lib/ci-steps.mjs';
import { COMMIT_ENV, checkTree, stampReport, treeReport, treeStamp } from './lib/fleet-tree.mjs';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const TAIL = 80;
const say = (line) => console.log(`ci-postbuild: ${line}`);

const check = checkTree(ROOT, process.env);
if (!check.armed) {
  say(`refusing: this tree was not armed by fleet-postbuild.mjs (no ${COMMIT_ENV}). Run npm run test:fleet:postbuild.`);
  process.exit(2);
}
const tree = treeReport(check);
say(tree.text);
if (!tree.ok) process.exit(1);
const stamp = treeStamp(ROOT);

const { env: jobEnv, steps } = readCi(readFileSync(CI_YML, 'utf8'));
const nodeMajor = Number(process.versions.node.split('.')[0]);

// CI installs its pinned npm globally; here it goes in a per-version directory under the OS temp dir,
// and every other version's directory is deleted, so at most one is ever kept.
const npmBin = (version) => {
  const home = join(tmpdir(), 'weasel-ci-npm');
  const prefix = join(home, version);
  for (const old of existsSync(home) ? readdirSync(home) : []) if (old !== version) rmSync(join(home, old), { recursive: true, force: true });
  if (!existsSync(join(prefix, 'bin', 'npm'))) {
    execFileSync('npm', ['install', '--global', '--prefix', prefix, '--no-audit', '--no-fund', `npm@${version}`], { stdio: 'ignore' });
  }
  return join(prefix, 'bin');
};

// A step that starts vitest would otherwise read this run's commit as a branch run's selection.
const { [COMMIT_ENV]: _armed, ...baseEnv } = process.env;
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

const plan = [{ run: 'npm ci', env: {} }, ...builtSteps(steps, nodeMajor)];
const width = String(plan.length).length;
const started = Date.now();
let failed = 0;
let broken = '';
for (const [i, step] of plan.entries()) {
  const label = step.run.replace(/\n/g, ' && ');
  const at = `${String(i + 1).padStart(width)}/${plan.length}`;
  if (broken) {
    say(`${at} skip           ${label}  (after ${broken} failed)`);
    continue;
  }
  const t0 = Date.now();
  const { ok, output } = await runStep(step.run, step.env);
  say(`${at} ${ok ? 'ok  ' : 'FAIL'} ${((Date.now() - t0) / 1000).toFixed(1).padStart(7)}s  ${label}`);
  if (ok) continue;
  failed++;
  const lines = output.trimEnd().split('\n');
  console.log(lines.slice(-TAIL).map((line) => `    ${line}`).join('\n'));
  // Every later step reads what a build or an install writes.
  if (/^npm (ci|run build)\b/.test(step.run)) broken = label;
}

const end = stampReport(stamp, treeStamp(ROOT));
say(end.text);
say(`${failed ? `${failed} step(s) failed` : 'every step passed'} in ${((Date.now() - started) / 60000).toFixed(1)} min`);
process.exit(failed || !end.ok ? 1 : 0);
