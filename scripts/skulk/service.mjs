#!/usr/bin/env node
/**
 * The nightly audit as an onto service: requests on stdin, replies on stdout, one JSON object per line.
 * Everything else goes to stderr, which onto keeps as the service's log. README.md beside this file says
 * how to bring it up and what each request does.
 */
import { execFile, execFileSync, spawn } from 'node:child_process';
import { join } from 'node:path';
import { createInterface } from 'node:readline';
import { fileURLToPath } from 'node:url';
import { after } from '../../packages/registry/src/after.ts';
import { lastFinished, lastStartedAt, liveRuns, requestStop } from './runs.mjs';
import { handle, msUntil, shouldAutoStart } from './serviceCore.mjs';

/** The checkout runs start from: the main checkout, not onto's copy of the tree this service runs in. */
const ROOT = process.env.WEASEL_ROOT ?? fileURLToPath(new URL('../..', import.meta.url));
const NIGHT = join(ROOT, 'scripts/skulk/night.mjs');
const log = (line) => process.stderr.write(`${new Date().toISOString()} ${line}\n`);

/** The runs this service started that have not exited, by pid, with the last line each printed. */
const children = new Map();
let startedHere;

/** A run this service started counts before it has claimed its round, so the 23:00 check never starts a second. */
const anyRunning = () => children.size > 0 || liveRuns().length > 0;

const lastStarted = () => {
  const times = [lastStartedAt(), startedHere].filter(Boolean);
  return times.length ? new Date(Math.max(...times)) : undefined;
};

const start = (args) => {
  startedHere = new Date();
  const child = spawn('node', [NIGHT, ...args], { cwd: ROOT, env: { ...process.env, WEASEL_ROOT: ROOT }, stdio: ['ignore', 'pipe', 'pipe'] });
  const entry = { lastLine: '' };
  children.set(child.pid, entry);
  log(`run started: node ${NIGHT} ${args.join(' ')} (pid ${child.pid})`);
  for (const stream of [child.stdout, child.stderr]) {
    createInterface({ input: stream }).on('line', (line) => {
      entry.lastLine = line;
      log(`run ${child.pid}: ${line}`);
    });
  }
  child.on('close', (code) => {
    log(`run ${child.pid} exited ${code}`);
    children.delete(child.pid);
  });
  return args;
};

const deps = {
  build: (() => {
    try {
      return execFileSync('git', ['rev-parse', '--short', 'HEAD'], { cwd: ROOT, encoding: 'utf8' }).trim();
    } catch {
      return 'unknown';
    }
  })(),
  live: () => liveRuns().map((r) => r.round),
  status: () => {
    const runs = liveRuns().map((r) => (children.has(r.pid) ? { ...r, lastLine: children.get(r.pid).lastLine } : r));
    return { running: runs.length > 0, runs, last: lastFinished() ?? null };
  },
  plan: () =>
    new Promise((done) => {
      execFile('node', [NIGHT, '--dry'], { cwd: ROOT, env: { ...process.env, WEASEL_ROOT: ROOT } }, (error, stdout, stderr) => {
        done((error ? `${stdout}${stderr}` : stdout).trim().split('\n'));
      });
    }),
  start,
  stop: (rounds) => {
    for (const round of rounds) requestStop(round);
    log(`stop requested for round ${rounds.join(', ')}`);
  },
};

const autoStart = () => {
  if (shouldAutoStart({ now: new Date(), running: anyRunning(), lastStarted: lastStarted() })) start([]);
};

const schedule = () => {
  const wait = msUntil(new Date());
  log(`next automatic night check in ${(wait / 3_600_000).toFixed(2)} h`);
  after(wait, () => {
    autoStart();
    schedule();
  });
};

// No check at startup: a restart (every `onto sync`) never starts a night, only the 23:00 timer does.
schedule();

createInterface({ input: process.stdin }).on('line', async (line) => {
  if (!line.trim()) return;
  const reply = await handle(line, deps);
  process.stdout.write(`${JSON.stringify(reply)}\n`);
});
