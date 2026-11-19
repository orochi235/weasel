#!/usr/bin/env node
/**
 * The nightly audit as an onto service: requests on stdin, replies on stdout, one JSON object per line.
 * Everything else goes to stderr, which onto keeps as the service's log. README.md beside this file says
 * how to bring it up and what each request does.
 */
import { execFile, execFileSync, spawn } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { createInterface } from 'node:readline';
import { fileURLToPath } from 'node:url';
import { after } from '../../packages/registry/src/after.ts';
import { STATE_DIR } from './config.mjs';
import { CURRENT_FILE, LAST_FILE, STOP_FILE } from './night.mjs';
import { handle, msUntil, shouldAutoStart } from './serviceCore.mjs';

/** The checkout nights run from: the main checkout, not onto's copy of the tree this service runs in. */
const ROOT = process.env.WEASEL_ROOT ?? fileURLToPath(new URL('../..', import.meta.url));
const NIGHT = join(ROOT, 'scripts/skulk/night.mjs');
const log = (line) => process.stderr.write(`${new Date().toISOString()} ${line}\n`);
const readJson = (path) => {
  try {
    return JSON.parse(readFileSync(path, 'utf8'));
  } catch {
    return undefined;
  }
};

let child;
let lastLine = '';
let lastStarted = readJson(LAST_FILE)?.started ? new Date(readJson(LAST_FILE).started) : undefined;

const alive = (pid) => {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return error.code === 'EPERM';
  }
};

/** A night this service started, or one started by hand that is still writing its status. */
const running = () => {
  if (child !== undefined) return true;
  const pid = readJson(CURRENT_FILE)?.pid;
  return Number.isInteger(pid) && alive(pid);
};

const start = (args) => {
  lastStarted = new Date();
  child = spawn('node', [NIGHT, ...args], { cwd: ROOT, env: { ...process.env, WEASEL_ROOT: ROOT }, stdio: ['ignore', 'pipe', 'pipe'] });
  log(`night started: node ${NIGHT} ${args.join(' ')} (pid ${child.pid})`);
  for (const stream of [child.stdout, child.stderr]) {
    createInterface({ input: stream }).on('line', (line) => {
      lastLine = line;
      log(`night: ${line}`);
    });
  }
  child.on('close', (code) => {
    log(`night exited ${code}`);
    child = undefined;
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
  running,
  status: () => ({
    running: running(),
    ...(running() ? { night: readJson(CURRENT_FILE), lastLine } : {}),
    last: readJson(LAST_FILE),
  }),
  plan: () =>
    new Promise((done) => {
      execFile('node', [NIGHT, '--dry'], { cwd: ROOT, env: { ...process.env, WEASEL_ROOT: ROOT } }, (error, stdout, stderr) => {
        done((error ? `${stdout}${stderr}` : stdout).trim().split('\n'));
      });
    }),
  start,
  stop: () => {
    mkdirSync(STATE_DIR, { recursive: true });
    writeFileSync(STOP_FILE, new Date().toISOString());
    log('stop requested');
  },
};

const schedule = () => {
  const wait = msUntil(new Date());
  log(`next automatic night check in ${(wait / 3_600_000).toFixed(2)} h`);
  after(wait, () => {
    if (shouldAutoStart({ now: new Date(), running: running(), lastStarted })) start([]);
    schedule();
  });
};

if (shouldAutoStart({ now: new Date(), running: running(), lastStarted })) start([]);
schedule();

createInterface({ input: process.stdin }).on('line', async (line) => {
  if (!line.trim()) return;
  const reply = await handle(line, deps);
  process.stdout.write(`${JSON.stringify(reply)}\n`);
});
