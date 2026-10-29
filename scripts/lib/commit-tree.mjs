/**
 * What a fleet job ships when it tests a commit rather than the working tree: a throwaway detached
 * worktree of that commit, and the onto launch that retries while the node's tree is busy.
 */
import { execFileSync, spawn, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { hostname } from 'node:os';
import { join } from 'node:path';

const BUSY_TRIES = 30;
const BUSY_WAIT_S = 30;
/** A tree with no owner file predates them or is mid-creation; give it this long. */
const OWNERLESS_GRACE_MS = 24 * 3600_000;
const OWNER = '.owner';

const alive = (pid) => {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return error.code === 'EPERM';
  }
};

const gitIn = (root) => (...args) => execFileSync('git', args, { cwd: root, encoding: 'utf8', maxBuffer: 1 << 28 }).trim();

/** The local branch `ref` names, or '' for a commit, a tag, or a detached HEAD. */
const branchOf = (git, ref) => {
  try {
    const name = git('rev-parse', '--abbrev-ref', ref);
    git('show-ref', '--verify', '--quiet', `refs/heads/${name}`);
    return name;
  } catch {
    return '';
  }
};

/**
 * Removes the trees under `dir` whose creating process is gone. SIGKILL, or a shell torn down under a
 * run, skips `drop()` and the signal handlers, so each tree records its creator in `<tree>.owner`.
 * A tree another host owns is left alone: its pid means nothing here. Returns the trees removed.
 */
export const sweepStaleTrees = (dir, git, { host = hostname(), isAlive = alive, now = Date.now() } = {}) => {
  if (!existsSync(dir)) return [];
  const removed = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (!entry.isDirectory()) {
      if (entry.name.endsWith(OWNER) && !existsSync(path.slice(0, -OWNER.length))) rmSync(path, { force: true });
      continue;
    }
    let owner = null;
    try {
      owner = JSON.parse(readFileSync(path + OWNER, 'utf8'));
    } catch {}
    const stale = owner
      ? owner.host === host && !isAlive(owner.pid)
      : now - (statSync(path, { throwIfNoEntry: false })?.mtimeMs ?? now) > OWNERLESS_GRACE_MS;
    if (!stale) continue;
    try {
      git('worktree', 'remove', '--force', path);
    } catch {}
    rmSync(path, { recursive: true, force: true });
    rmSync(path + OWNER, { force: true });
    removed.push(path);
  }
  if (removed.length > 0) git('worktree', 'prune');
  return removed;
};

/**
 * Checks `ref` out detached under the main checkout's `.worktrees/`, and removes it on `drop()` or
 * when a signal kills the process — `finally` never runs then, and a killed run would leave its tree.
 * What neither catches, the next run's sweep does.
 */
export const openCommitTree = (root, ref, prefix) => {
  const git = gitIn(root);
  const commit = git('rev-parse', '--verify', `${ref}^{commit}`);
  const branch = branchOf(git, ref);
  const main = git('worktree', 'list', '--porcelain').split('\n')[0].replace(/^worktree /, '');
  const dir = join(main, '.worktrees');
  mkdirSync(dir, { recursive: true });
  sweepStaleTrees(dir, git);
  const tree = mkdtempSync(join(dir, prefix));
  writeFileSync(tree + OWNER, JSON.stringify({ pid: process.pid, host: hostname() }));
  git('worktree', 'add', '--detach', '--force', tree, commit);
  const drop = () => {
    git('worktree', 'remove', '--force', tree);
    rmSync(tree, { recursive: true, force: true });
    rmSync(tree + OWNER, { force: true });
  };
  for (const signal of ['SIGINT', 'SIGTERM', 'SIGHUP']) {
    process.once(signal, () => {
      drop();
      process.exit(128 + { SIGHUP: 1, SIGINT: 2, SIGTERM: 15 }[signal]);
    });
  }
  return { commit, branch, tree, drop, git };
};

/** `onto` with its output passed straight through, and what it wrote to stderr kept to read after. */
const ontoOnce = (args, cwd) =>
  new Promise((done) => {
    const child = spawn('onto', args, { cwd, stdio: ['inherit', 'inherit', 'pipe'] });
    let stderr = '';
    child.stderr.on('data', (chunk) => {
      stderr += chunk;
      process.stderr.write(chunk);
    });
    child.on('error', (error) => done({ status: 1, stderr: String(error) }));
    child.on('close', (status) => done({ status: status ?? 1, stderr }));
  });

/**
 * A node runs one job per tree, so a launch while another session's job holds it is refused before
 * anything has run. Wait for it rather than fail. Resolves to onto's exit status.
 */
export const ontoWhenFree = async (args, { cwd, say }) => {
  for (let attempt = 1; ; attempt++) {
    const run = await ontoOnce(args, cwd);
    if (!/working tree .* is busy/.test(run.stderr) || attempt === BUSY_TRIES) return run.status;
    say(`the node's tree is busy, retrying in ${BUSY_WAIT_S}s (${attempt}/${BUSY_TRIES})`);
    spawnSync('sleep', [String(BUSY_WAIT_S)]);
  }
};
