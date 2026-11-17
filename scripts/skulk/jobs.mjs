/**
 * Model jobs on the fleet. Each job runs `onto do` from the frozen tree, so the node's tree is the
 * frozen commit plus `.skulk/in`, in a tree name of its own (a slot) so jobs on one node never
 * share a tree. What a job writes under `.skulk/out` comes back to a local directory.
 */
import { spawn, spawnSync } from 'node:child_process';
import { createWriteStream, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import {
  CLAUDE_CONFIG, FIX_MODEL, FIX_SLOTS_PER_NODE, JOB_IN, JOB_OUT, JOB_TIMEOUT_MIN, MATCH_MODEL, NO_FIXERS,
  REFUSED_COOLDOWN_MIN, REVIEW_DENIED, REVIEW_MODEL, REVIEW_SLOTS_PER_NODE, REVIEW_TOOLS, nodesAt,
} from './config.mjs';

const NVM = 'export NVM_DIR="${NVM_DIR:-$HOME/.nvm}"; . "$NVM_DIR/nvm.sh" >/dev/null; nvm use >/dev/null';
const BUSY = /working tree .* is busy/;
const REFUSED = /\bquiet\b|refuses|is offline|not reachable|unavailable/i;
const BUSY_WAIT_MS = 30_000;

const q = (s) => `'${String(s).replace(/'/g, `'\\''`)}'`;

/** Runs `claude -p` on a prompt file, stopped by an alarm before onto's timeout so what it wrote still comes home. */
const claudeLine = (promptFile, budgetUsd, flags) =>
  [
    `CLAUDE_CONFIG_DIR=${CLAUDE_CONFIG}`,
    `perl -e 'alarm shift; exec @ARGV' ${JOB_TIMEOUT_MIN * 60}`,
    'claude -p "$(cat', `${q(promptFile)})"`,
    `--output-format json --strict-mcp-config --max-budget-usd ${budgetUsd}`, ...flags,
    `> ${JOB_OUT}/claude.json 2> ${JOB_OUT}/claude.err; echo $? > ${JOB_OUT}/exit`,
  ].join(' ');

const model = (name) => (name ? ['--model', name] : []);
const fresh = `rm -rf ${JOB_OUT} && mkdir -p ${JOB_OUT}`;

export const reviewShell = (area, budgetUsd) =>
  [fresh, claudeLine(`${JOB_IN}/${area}/review.md`, budgetUsd, [
    '--allowedTools', q(REVIEW_TOOLS.join(',')), '--disallowedTools', q(REVIEW_DENIED.join(',')), ...model(REVIEW_MODEL),
  ])].join(' && ');

export const matchShell = (area, budgetUsd) =>
  [fresh, claudeLine(`${JOB_IN}/${area}/match.md`, budgetUsd, ['--disallowedTools', q('Bash,Edit,Write,Task,Agent'), ...model(MATCH_MODEL)])].join(' && ');

/**
 * The fixer commits the synced tree as it stands (it must hash to the frozen commit's tree), installs
 * when the lockfile changed since the tree's last install, lets the model fix and commit, and hands
 * back its commits as one mbox.
 */
export const fixShell = (area, budgetUsd) =>
  [
    'set -e', NVM, fresh,
    'grep -qx ".skulk/" .git/info/exclude 2>/dev/null || echo ".skulk/" >> .git/info/exclude',
    'git add -A',
    'git -c user.name=skulk -c user.email=skulk@localhost commit -q --no-verify --allow-empty -m "skulk: frozen tree"',
    `if [ "$(git rev-parse 'HEAD^{tree}')" != "$FROZEN_TREE" ]; then echo "synced tree $(git rev-parse 'HEAD^{tree}') is not the frozen tree $FROZEN_TREE" > ${JOB_OUT}/tree-mismatch; exit 0; fi`,
    'BASE=$(git rev-parse HEAD)',
    'LOCK=$(shasum package-lock.json | cut -d" " -f1)',
    `if [ "$(cat node_modules/.skulk-lock 2>/dev/null)" != "$LOCK" ]; then npm ci --no-audit --no-fund > ${JOB_OUT}/npm-ci.log 2>&1 && echo "$LOCK" > node_modules/.skulk-lock; fi`,
    'set +e',
    claudeLine(`${JOB_IN}/${area}/fix.md`, budgetUsd, ['--dangerously-skip-permissions', ...model(FIX_MODEL)]),
    `git format-patch --stdout "$BASE..HEAD" > ${JOB_OUT}/fix.mbox`,
    `git status --porcelain > ${JOB_OUT}/uncommitted.txt`,
    'exit 0',
  ].join('\n');

/** Slots: one tree name per concurrent job on a node. `pinned` replaces the time-of-day node list. */
export const createSlots = (pinned) => {
  const busy = new Set();
  const refusedUntil = new Map();
  const take = (role, { now = new Date(), exclude = new Set() } = {}) => {
    const perNode = role === 'fix' ? FIX_SLOTS_PER_NODE : REVIEW_SLOTS_PER_NODE;
    for (const node of pinned ?? nodesAt(now)) {
      if (role === 'fix' && NO_FIXERS.includes(node)) continue;
      if (exclude.has(node) || (refusedUntil.get(node) ?? 0) > now.getTime()) continue;
      for (let k = 1; k <= perNode; k++) {
        const tree = `weasel-skulk-${role === 'fix' ? 'f' : 'r'}${k}`;
        const key = `${node}/${tree}`;
        if (busy.has(key)) continue;
        busy.add(key);
        return { node, tree, release: () => busy.delete(key) };
      }
    }
    return undefined;
  };
  const refuse = (node, now = Date.now()) => refusedUntil.set(node, now + REFUSED_COOLDOWN_MIN * 60_000);
  return { take, refuse, inUse: () => busy.size };
};

const ontoOnce = (args, cwd, log) =>
  new Promise((done) => {
    const child = spawn('onto', args, { cwd, stdio: ['ignore', 'pipe', 'pipe'] });
    let stderr = '';
    child.stdout.pipe(log, { end: false });
    child.stderr.on('data', (chunk) => {
      stderr += chunk;
      log.write(chunk);
    });
    child.on('error', (error) => done({ status: 1, stderr: String(error) }));
    child.on('close', (status) => done({ status: status ?? 1, stderr }));
  });

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * One job, retried while its tree is busy. Answers `{ status, refused }`: `refused` when the node
 * turned the job away as quiet or unavailable before anything ran, so the caller tries another node.
 */
export const runJob = async ({ frozen, base, slot, kind, task, about, expectMin, env = {}, shell, to, logPath }) => {
  mkdirSync(to, { recursive: true });
  const log = createWriteStream(logPath, { flags: 'a' });
  const args = [
    'do', '--kind', kind, '--node', slot.node, '--in', slot.tree, '--ref', base, '--force',
    '--timeout', `${JOB_TIMEOUT_MIN + 10}m`, '--expect', `${expectMin}m`, '--task', task, '--about', about,
    '--icon', kind === 'fix' ? 'wrench.and.screwdriver' : 'doc.text.magnifyingglass',
    '--out', JOB_OUT, '--to', to,
    ...Object.entries(env).flatMap(([k, v]) => ['--env', `${k}=${v}`]),
    '--', 'bash', '-lc', shell,
  ];
  try {
    for (;;) {
      const run = await ontoOnce(args, frozen, log);
      if (BUSY.test(run.stderr)) {
        await sleep(BUSY_WAIT_MS);
        continue;
      }
      return { status: run.status, refused: run.status !== 0 && REFUSED.test(run.stderr) && !/job .* (failed|exited)/.test(run.stderr) };
    }
  } finally {
    log.end();
  }
};

/** The nodes onto itself reports as quiet or unavailable, when it can say; otherwise none. */
export const unavailableNodes = () => {
  const run = spawnSync('onto', ['status', '--json'], { encoding: 'utf8', timeout: 30_000 });
  if (run.status !== 0) return new Set();
  try {
    const rows = JSON.parse(run.stdout);
    const list = Array.isArray(rows) ? rows : Object.entries(rows).map(([name, row]) => ({ name, ...row }));
    return new Set(list.filter((r) => r.quiet || r.available === false || r.online === false).map((r) => r.name ?? r.node));
  } catch {
    return new Set();
  }
};

export const jobDir = (nightDir, area, role) => join(nightDir, 'jobs', area, role);
