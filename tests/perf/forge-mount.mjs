#!/usr/bin/env node
// Times forge's timeline test file, which mounts the workshop two or three times a test, under jsdom.
// Usage: node tests/perf/forge-mount.mjs <label> <runs> <out.jsonl>
// One JSONL record per run: every test's duration, the file's, and the machine it ran on.
import { execFileSync, spawnSync } from 'node:child_process';
import { appendFileSync, mkdirSync, readFileSync, rmSync } from 'node:fs';
import { cpus, hostname, loadavg, release, tmpdir } from 'node:os';
import { dirname, join } from 'node:path';

const [label = 'run', runsArg = '5', out = 'tests/perf/results/forge-mount.jsonl'] = process.argv.slice(2);
const runs = Number(runsArg);
const FILE = 'packages/forge/src/timeline/timeline.test.tsx';
const git = (...args) => execFileSync('git', args, { encoding: 'utf8' }).trim();
const sha = git('rev-parse', 'HEAD');
const dirty = git('status', '--porcelain', '--untracked-files=no') !== '';
mkdirSync(dirname(out), { recursive: true });

for (let i = 1; i <= runs; i++) {
  const report = join(tmpdir(), `forge-mount-${process.pid}-${i}.json`);
  const load = loadavg();
  const started = Date.now();
  const res = spawnSync(
    'npx',
    ['vitest', 'run', '--project=forge', FILE, '--maxWorkers=1', '--reporter=json', `--outputFile=${report}`],
    { encoding: 'utf8' },
  );
  const wall = Date.now() - started;
  const json = JSON.parse(readFileSync(report, 'utf8'));
  rmSync(report, { force: true });
  const file = json.testResults[0];
  const tests = file.assertionResults.map((t) => ({ name: t.fullName, status: t.status, ms: t.duration }));
  const record = {
    schema: 'weasel-forge-mount/1',
    label,
    run: i,
    git: { sha, dirty },
    timestamp: new Date().toISOString(),
    machine: { host: hostname(), cpu: cpus()[0]?.model, cores: cpus().length, os: release(), node: process.version, loadavg: load },
    exit: res.status,
    wallMs: wall,
    fileMs: file.endTime - file.startTime,
    testsMs: tests.reduce((sum, t) => sum + (t.ms ?? 0), 0),
    tests,
  };
  appendFileSync(out, `${JSON.stringify(record)}\n`);
  console.log(`${i}/${runs} ${label} file ${record.fileMs.toFixed(0).padStart(6)} ms  tests ${record.testsMs.toFixed(0).padStart(6)} ms  exit ${res.status}`);
}
