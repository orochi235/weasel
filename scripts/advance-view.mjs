#!/usr/bin/env node
// Moves the `view` worktree (.claude/worktrees/view, a detached checkout that serves draw so other
// sessions' edits to main don't reload the browser tab) to a commit. Run by the pre-push hook for
// every push to main; `npm run view:advance [<rev>]` does it by hand, defaulting to main.
//
// When package-lock.json differs between the old and new commits it runs `npm ci` there, then
// starts draw again from the worktree; wake replaces the copy already running.
import { execFileSync, spawn } from 'node:child_process';
import { closeSync, existsSync, openSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';

const repo = resolve(import.meta.dirname, '..');
const common = resolve(repo, execFileSync('git', ['rev-parse', '--git-common-dir'], { cwd: repo, encoding: 'utf8' }).trim());
const main = dirname(common);
const view = join(main, '.claude/worktrees/view');
const rev = process.argv[2] ?? 'main';

const git = (...args) => execFileSync('git', ['-C', view, ...args], { encoding: 'utf8' }).trim();
const log = (msg) => console.log(`advance-view: ${msg}`);

if (!existsSync(view)) {
  log(`no worktree at ${view}; nothing to do`);
  process.exit(0);
}
if (git('status', '--porcelain', '--untracked-files=no')) {
  log('view has uncommitted changes; left where it is');
  process.exit(1);
}

const before = git('rev-parse', 'HEAD');
const after = git('rev-parse', `${rev}^{commit}`);
if (before === after) {
  log(`already at ${after.slice(0, 9)}`);
  process.exit(0);
}
git('checkout', '-q', '--detach', after);
log(`${before.slice(0, 9)} -> ${after.slice(0, 9)}`);

const lockChanged = execFileSync('git', ['-C', view, 'diff', '--name-only', before, after, '--', 'package-lock.json'], { encoding: 'utf8' }).trim();
if (!lockChanged) process.exit(0);

log('package-lock.json changed; npm ci');
execFileSync('npm', ['ci', '--no-audit', '--no-fund'], { cwd: view, stdio: 'inherit' });

const out = openSync(join(common, 'view-draw.log'), 'w');
spawn('npm', ['run', 'dev:draw'], { cwd: view, detached: true, stdio: ['ignore', out, out] }).unref();
closeSync(out);
log(`restarted draw from view; its output is in ${join(common, 'view-draw.log')}`);
