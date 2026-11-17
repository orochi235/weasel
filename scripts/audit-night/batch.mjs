/**
 * The git half of a night: fixer patches onto `audit<N>-<area>` branches, those merged into
 * `batch/<date>-audit<N>`, the round's record committed there, the fleet run on its tip, and `main`
 * fast-forwarded when it is green.
 */
import { execFileSync, spawn } from 'node:child_process';
import { cpSync, createWriteStream, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { partitionAt, writePartition } from './partition.mjs';
import { appendRecordRow, hardeningRow, roundReadme } from './record.mjs';
import { AUDITS_DIR, HARDENING } from './rounds.mjs';

export const gitIn = (cwd) => (...args) => execFileSync('git', args, { cwd, encoding: 'utf8', maxBuffer: 1 << 28, stdio: ['ignore', 'pipe', 'pipe'] }).trim();

const tryGit = (git, ...args) => {
  try {
    return { ok: true, out: git(...args) };
  } catch (error) {
    return { ok: false, out: String(error.stderr || error.message) };
  }
};

/** A detached worktree at `ref` under the main checkout's `.worktrees/`. */
export const addWorktree = (root, name, ref, branch) => {
  const path = join(root, '.worktrees', name);
  if (existsSync(path)) removeWorktree(root, path);
  gitIn(root)('worktree', 'add', ...(branch ? ['-b', branch] : ['--detach']), path, ref);
  return path;
};

export const removeWorktree = (root, path) => {
  tryGit(gitIn(root), 'worktree', 'remove', '--force', path);
  rmSync(path, { recursive: true, force: true });
  tryGit(gitIn(root), 'worktree', 'prune');
};

/**
 * `audit<N>-<area>` at the frozen commit with the fixer's mbox applied. Answers the commits it holds,
 * or `{ error }` with the branch deleted when the patches do not apply.
 */
export const applyFix = (root, { round, area, commit, mbox }) => {
  const branch = `audit${round}-${area}`;
  const tree = addWorktree(root, `audit-night-am-${area}`, commit, branch);
  const git = gitIn(tree);
  try {
    const am = tryGit(git, 'am', '--3way', '--keep-cr', mbox);
    if (!am.ok) {
      tryGit(git, 'am', '--abort');
      removeWorktree(root, tree);
      tryGit(gitIn(root), 'branch', '-D', branch);
      return { branch, error: am.out.split('\n').slice(0, 3).join(' ') };
    }
    const commits = git('rev-list', '--reverse', `${commit}..HEAD`).split('\n').filter(Boolean);
    return { branch, commits };
  } finally {
    removeWorktree(root, tree);
  }
};

/** Merges each branch into a new batch branch at `commit`; one that conflicts is left out. */
export const makeBatch = (root, { round, date, commit, branches }) => {
  const name = `batch/${date}-audit${round}`;
  const tree = addWorktree(root, `batch-${date}-audit${round}`, commit, name);
  const git = gitIn(tree);
  const merged = [];
  const conflicted = [];
  for (const branch of branches) {
    const run = tryGit(git, 'merge', '--no-ff', '--no-edit', '-m', `Merge branch '${branch}' into ${name}`, branch);
    if (run.ok) merged.push(branch);
    else {
      tryGit(git, 'merge', '--abort');
      conflicted.push(branch);
    }
  }
  return { name, tree, merged, conflicted };
};

/** Writes the round's raw lists, README, partition and hardening row into the batch, and commits them. */
export const commitRecord = (tree, { round, commit, date, nightDir, areas, outcomes, coAuthor }) => {
  const dir = join(tree, AUDITS_DIR, `round-${round}`);
  mkdirSync(dir, { recursive: true });
  for (const area of areas) {
    const to = join(dir, area.id);
    mkdirSync(to, { recursive: true });
    for (const file of ['files.txt', 'A.md', 'B.md', 'match.json', 'fix.md']) {
      const from = join(nightDir, 'areas', area.id, file);
      if (existsSync(from)) cpSync(from, join(to, file));
    }
    writeFileSync(join(to, 'area.json'), `${JSON.stringify(area, null, 1)}\n`);
  }
  if (existsSync(join(nightDir, 'usage.jsonl'))) cpSync(join(nightDir, 'usage.jsonl'), join(dir, 'usage.jsonl'));
  writeFileSync(join(dir, 'README.md'), roundReadme({ round, commit, date, areas, outcomes }));
  writePartition(tree, partitionAt(tree, commit));
  const hardening = join(tree, HARDENING);
  writeFileSync(hardening, appendRecordRow(readFileSync(hardening, 'utf8'), hardeningRow({ round, date, areas })));
  const git = gitIn(tree);
  git('add', '--', AUDITS_DIR, HARDENING);
  git('commit', '-q', '-m', `record audit round ${round}: ${areas.length} areas' raw findings, estimates and fixes\n\n${coAuthor}`);
  return git('rev-parse', 'HEAD');
};

/** Runs an npm script from the main checkout against `ref`, its output to `logPath`. Answers its exit status. */
export const runFleetScript = (root, script, ref, logPath) =>
  new Promise((done) => {
    const log = createWriteStream(logPath, { flags: 'a' });
    const child = spawn('npm', ['run', script, '--', ref], { cwd: root, stdio: ['ignore', 'pipe', 'pipe'] });
    child.stdout.pipe(log, { end: false });
    child.stderr.pipe(log, { end: false });
    child.on('error', () => done(1));
    child.on('close', (status) => {
      log.end();
      done(status ?? 1);
    });
  });

/**
 * Moves `main` to `tip` when that is a fast-forward and the main checkout is on `main` and clean.
 * Answers what happened, in a sentence for the report.
 */
export const fastForwardMain = (root, tip) => {
  const git = gitIn(root);
  if (git('rev-parse', '--abbrev-ref', 'HEAD') !== 'main') return 'not fast-forwarded: the main checkout is not on main';
  if (git('status', '--porcelain', '--untracked-files=no')) return 'not fast-forwarded: the main checkout has uncommitted changes';
  const run = tryGit(git, 'merge', '--ff-only', tip);
  return run.ok ? `main fast-forwarded to ${tip.slice(0, 10)}` : `not fast-forwarded: ${run.out.split('\n')[0]}`;
};
