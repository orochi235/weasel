#!/usr/bin/env node
/**
 * One night of blind-pair audit rounds. README.md beside this file is its documentation.
 *
 *   node scripts/audit-night/night.mjs [--areas K] [--only <id>,…] [--nodes <a>,…] [--dry] [--no-merge]
 *     [--cap-usd N] [--budget-review USD] [--budget-match USD] [--budget-fix USD]
 */
import { appendFileSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { runArea } from './area.mjs';
import { addWorktree, applyFix, commitRecord, fastForwardMain, gitIn, makeBatch, removeWorktree, runFleetScript } from './batch.mjs';
import {
  AREAS_PER_NIGHT, AREA_USD_GUESS, JOB_BUDGET_USD, JOB_IN, KEEP_NIGHTS, NIGHT_USD_CAP, REVIEW_SLOTS_PER_NODE, STATE_DIR, STOP_AT, nodesAt,
} from './config.mjs';
import { createSlots, unavailableNodes } from './jobs.mjs';
import { partitionAt } from './partition.mjs';
import { AUDITS_DIR, HARDENING, gitTouched, nextRound, pickAreas, readPasses } from './rounds.mjs';
import { mayStartArea } from './usage.mjs';

const CO_AUTHOR = 'Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>';
const POLL_MS = 15_000;
const UNAVAILABLE_TTL_MS = 5 * 60_000;

export const STOP_FILE = join(STATE_DIR, 'stop');
export const CURRENT_FILE = join(STATE_DIR, 'current.json');
export const LAST_FILE = join(STATE_DIR, 'last.json');

const usd = (n) => `$${n.toFixed(2)}`;
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const localDate = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

/** The first `hh:mm` local after `from`. */
export const nextClock = (from, hhmm) => {
  const [h, m] = hhmm.split(':').map(Number);
  const at = new Date(from);
  at.setHours(h, m, 0, 0);
  if (at <= from) at.setDate(at.getDate() + 1);
  return at;
};

export const parseArgs = (argv) => {
  const value = (flag) => {
    const i = argv.indexOf(flag);
    return i < 0 ? undefined : argv[i + 1];
  };
  const number = (flag, fallback) => {
    const v = value(flag);
    if (v === undefined) return fallback;
    const n = Number(v);
    if (!Number.isFinite(n) || n < 0) throw new Error(`${flag} wants a non-negative number, not ${v}`);
    return n;
  };
  return {
    areas: number('--areas', AREAS_PER_NIGHT),
    only: value('--only')?.split(',').filter(Boolean),
    nodes: value('--nodes')?.split(',').filter(Boolean),
    dry: argv.includes('--dry'),
    merge: !argv.includes('--no-merge'),
    capUsd: number('--cap-usd', NIGHT_USD_CAP),
    budget: {
      review: number('--budget-review', JOB_BUDGET_USD.review),
      match: number('--budget-match', JOB_BUDGET_USD.match),
      fix: number('--budget-fix', JOB_BUDGET_USD.fix),
    },
  };
};

const mainCheckout = () => {
  if (process.env.WEASEL_ROOT) return process.env.WEASEL_ROOT;
  const here = fileURLToPath(new URL('../..', import.meta.url));
  return gitIn(here)('worktree', 'list', '--porcelain').split('\n')[0].replace(/^worktree /, '');
};

const pruneNights = () => {
  const dir = join(STATE_DIR, 'nights');
  if (!existsSync(dir)) return;
  const nights = readdirSync(dir).sort();
  for (const old of nights.slice(0, Math.max(0, nights.length - KEEP_NIGHTS))) rmSync(join(dir, old), { recursive: true, force: true });
};

/** The files of `files` some commit after `from`, other than `exclude`, changed. */
const changedSince = (git, files, from, exclude) => {
  if (!from || files.length === 0) return [];
  const skip = new Set(exclude);
  const out = git('log', '--no-merges', '--format=@%H', '--name-only', `${from}..HEAD`, '--', ...files);
  const changed = new Set();
  let keep = false;
  for (const line of out.split('\n')) {
    if (line.startsWith('@')) keep = !skip.has(line.slice(1));
    else if (line && keep) changed.add(line);
  }
  return [...changed];
};

const plan = (root, args) => {
  const git = gitIn(root);
  const commit = git('rev-parse', 'main');
  const branches = git('for-each-ref', '--format=%(refname:short)', 'refs/heads').split('\n');
  const roundDirs = existsSync(join(root, AUDITS_DIR)) ? readdirSync(join(root, AUDITS_DIR)) : [];
  const round = nextRound({ roundDirs, hardening: readFileSync(join(root, HARDENING), 'utf8'), branches });
  const areas = partitionAt(root, commit);
  const passes = readPasses(root);
  const byId = new Map(areas.map((a) => [a.id, a]));
  const unknown = (args.only ?? []).filter((id) => !byId.has(id));
  if (unknown.length > 0) throw new Error(`no area named ${unknown.join(', ')}; see docs/audits/partition.json`);
  const picked = args.only
    ? args.only.slice(0, args.areas)
    : pickAreas({ areas, passes, touched: gitTouched(git), count: args.areas }).picked;
  return { commit, round, picked: picked.map((id) => byId.get(id)), passes };
};

const printPlan = (p, args, say) => {
  say(`round ${p.round} at ${p.commit.slice(0, 10)}; nodes: ${(args.nodes ?? nodesAt(new Date())).join(', ')}${args.nodes ? ' (pinned)' : ''}; stops dispatching at ${STOP_AT}`);
  say(`budget: ${usd(args.capUsd)} tonight; per job $${args.budget.review} review, $${args.budget.match} match, $${args.budget.fix} fix`);
  for (const area of p.picked) {
    const last = p.passes.get(area.id)?.at(-1);
    say(`  ${area.id}: ${area.files.length} files${last ? `, last pass round ${last.round} (${last.distinct} distinct, ~${last.unfound} left)` : ', never audited'}`);
    say(`    ${area.files.slice(0, 4).join(' ')}${area.files.length > 4 ? ' …' : ''}`);
  }
  say(`jobs: ${p.picked.length * 2} reviews, up to ${p.picked.length} matches and ${p.picked.length} fixes; then batch/${localDate()}-audit${p.round}`);
};

/** Starts each picked area while the night has time, budget and no stop request; resolves when all finish. */
const reviewAreas = async ({ ctx, git, picked, passes, args, status, deadline, results }) => {
  const inFlight = new Set();
  const maxAreas = Math.max(1, Math.floor(((args.nodes ?? nodesAt(new Date())).length * REVIEW_SLOTS_PER_NODE) / 2));
  for (const area of picked) {
    while (inFlight.size >= maxAreas) await Promise.race(inFlight);
    const affordable = mayStartArea({ used: status.costUsd, finished: results.map((r) => r.jobs.costUsd), inFlight: inFlight.size, cap: args.capUsd, guess: AREA_USD_GUESS });
    const why = ctx.stopped() ? 'stop requested'
      : new Date() >= deadline ? `past ${STOP_AT}`
        : !affordable ? `the next area would cross the ${usd(args.capUsd)} cap (${usd(status.costUsd)} used)` : '';
    if (why) {
      ctx.say(`not starting ${area.id}: ${why}`);
      continue;
    }
    const previous = passes.get(area.id)?.at(-1);
    const job = runArea(ctx, area, { previous, changedSince: changedSince(git, area.files, previous?.commit, previous?.fixCommits ?? []) })
      .then((summary) => results.push(summary))
      .catch((error) => ctx.say(`area ${area.id} failed: ${error.stack ?? error}`))
      .finally(() => inFlight.delete(job));
    inFlight.add(job);
  }
  await Promise.all(inFlight);
};

/** Each fixer's mbox onto its own `audit<N>-<area>` branch. Answers the branches that took their patches. */
const patchAreas = ({ root, round, commit, nightDir, results, outcomes, say }) => {
  const branches = [];
  for (const summary of results) {
    const mbox = join(nightDir, 'areas', summary.id, 'fix.mbox');
    if (!existsSync(mbox)) {
      outcomes[summary.id] = summary.distinct > 0 ? 'no commits' : 'nothing to fix';
      continue;
    }
    const applied = applyFix(root, { round, area: summary.id, commit, mbox });
    if (applied.error) {
      outcomes[summary.id] = 'patches did not apply';
      say(`patch ${summary.id}: did not apply: ${applied.error}`);
      continue;
    }
    summary.fixCommits = applied.commits;
    branches.push(applied.branch);
    say(`patch ${summary.id}: ${applied.commits.length} commits on ${applied.branch}`);
  }
  return branches;
};

/** Merges the branches into the batch, records the round there, runs the fleet on its tip, and merges if green. */
const batchAndTest = async ({ root, git, round, commit, date, nightDir, branches, results, outcomes, merge, say, setStep }) => {
  const batch = makeBatch(root, { round, date, commit, branches });
  const idOf = (branch) => branch.replace(`audit${round}-`, '');
  for (const branch of batch.merged) outcomes[idOf(branch)] = `\`${branch}\``;
  for (const branch of batch.conflicted) {
    outcomes[idOf(branch)] = `\`${branch}\`, left out: merge conflict`;
    results.find((s) => s.id === idOf(branch)).fixCommits = [];
    say(`batch: ${branch} conflicts; left out`);
  }
  const tip = commitRecord(batch.tree, { round, commit, date, nightDir, areas: results, outcomes, coAuthor: CO_AUTHOR });
  say(`record: docs/audits/round-${round}/ committed on ${batch.name} at ${tip.slice(0, 10)}`);

  setStep('fleet');
  const logName = batch.name.replace(/\//g, '-');
  const [tests, postbuild] = await Promise.all([
    runFleetScript(root, 'test:fleet', batch.name, join(nightDir, `${logName}.test-fleet.log`)),
    runFleetScript(root, 'test:fleet:postbuild', batch.name, join(nightDir, `${logName}.postbuild.log`)),
  ]);
  say(`fleet: test:fleet ${tests === 0 ? 'passed' : `failed (${tests})`}, test:fleet:postbuild ${postbuild === 0 ? 'passed' : `failed (${postbuild})`}`);
  if (tests !== 0 || postbuild !== 0) return `red: ${batch.name} and its branches kept; worktree ${batch.tree}; logs in ${nightDir}`;
  removeWorktree(root, batch.tree);
  if (!merge) return `green; --no-merge, so main is untouched and ${batch.name} and its branches are kept`;
  const result = fastForwardMain(root, tip);
  if (result.startsWith('main fast-forwarded')) for (const b of [...batch.merged, batch.name]) git('branch', '-D', b);
  return result;
};

export const runNight = async (argv = process.argv.slice(2), say = (line) => console.log(line)) => {
  const args = parseArgs(argv);
  const root = mainCheckout();
  const git = gitIn(root);
  const p = plan(root, args);
  printPlan(p, args, say);
  if (args.dry || p.picked.length === 0) return { round: p.round, dry: true };

  mkdirSync(STATE_DIR, { recursive: true });
  rmSync(STOP_FILE, { force: true });
  pruneNights();
  const started = new Date();
  const date = localDate(started);
  const nightDir = join(STATE_DIR, 'nights', `${started.toISOString().replace(/[:.]/g, '-')}-round${p.round}`);
  mkdirSync(nightDir, { recursive: true });
  const echo = say;
  say = (line) => {
    echo(line);
    appendFileSync(join(nightDir, 'night.log'), `${line}\n`);
  };
  const status = { round: p.round, started: started.toISOString(), step: 'freeze', areas: p.picked.map((a) => a.id), nightDir, tokens: 0, costUsd: 0, capUsd: args.capUsd };
  const setStep = (step) => {
    status.step = step;
    writeFileSync(CURRENT_FILE, JSON.stringify({ ...status, pid: process.pid }));
  };
  setStep('freeze');

  const frozen = addWorktree(root, `audit${p.round}-frozen-night`, p.commit);
  const deadline = nextClock(started, STOP_AT);
  const slots = createSlots(args.nodes);
  let unavailable = { at: 0, nodes: new Set() };
  const counts = {};
  const ctx = {
    round: p.round, commit: p.commit, date, frozen, nightDir, budget: args.budget,
    base: git('merge-base', p.commit, 'origin/main'),
    frozenTree: git('rev-parse', `${p.commit}^{tree}`),
    identity: Object.fromEntries(['NAME', 'EMAIL'].flatMap((k) => {
      const v = git('config', `user.${k.toLowerCase()}`);
      return [[`GIT_AUTHOR_${k}`, v], [`GIT_COMMITTER_${k}`, v]];
    })),
    total: { review: p.picked.length * 2, match: p.picked.length, fix: p.picked.length },
    stopped: () => existsSync(STOP_FILE),
    say,
    progress: (kind, msg, total) => say(`${kind} ${(counts[kind] = (counts[kind] ?? 0) + 1)}/${total} ${msg}`),
    refuse: (node) => slots.refuse(node),
    usage: (record) => {
      appendFileSync(join(nightDir, 'usage.jsonl'), `${JSON.stringify({ round: p.round, ...record })}\n`);
      status.tokens += record.totalTokens;
      status.costUsd += record.costUsd;
      setStep(status.step);
    },
    acquire: async (role) => {
      for (;;) {
        if (Date.now() - unavailable.at > UNAVAILABLE_TTL_MS) unavailable = { at: Date.now(), nodes: unavailableNodes() };
        const slot = slots.take(role, { exclude: unavailable.nodes });
        if (slot) return slot;
        await sleep(POLL_MS);
      }
    },
  };

  const results = [];
  const outcomes = {};
  let report = '';
  try {
    setStep('review');
    mkdirSync(join(frozen, JOB_IN), { recursive: true });
    await reviewAreas({ ctx, git, picked: p.picked, passes: p.passes, args, status, deadline, results });
    if (results.length === 0) throw new Error('no area finished');
    results.sort((a, b) => (a.id < b.id ? -1 : 1));
    setStep('patch');
    const branches = patchAreas({ root, round: p.round, commit: p.commit, nightDir, results, outcomes, say });
    setStep('batch');
    report = await batchAndTest({ root, git, round: p.round, commit: p.commit, date, nightDir, branches, results, outcomes, merge: args.merge, say, setStep });
    say(`night: ${report}`);
  } finally {
    removeWorktree(root, frozen);
    const summary = {
      round: p.round, commit: p.commit, started: started.toISOString(), ended: new Date().toISOString(), report,
      tokens: status.tokens, costUsd: status.costUsd, capUsd: args.capUsd,
      areas: results.map((s) => ({ id: s.id, a: s.a, b: s.b, m: s.m, distinct: s.distinct, chapman: s.chapman, patches: s.patches, outcome: outcomes[s.id], minutes: s.jobs.minutes, tokens: s.jobs.tokens, costUsd: s.jobs.costUsd, budgetHit: s.budgetHit })),
    };
    writeFileSync(join(nightDir, 'summary.json'), `${JSON.stringify(summary, null, 1)}\n`);
    writeFileSync(LAST_FILE, `${JSON.stringify(summary, null, 1)}\n`);
    rmSync(CURRENT_FILE, { force: true });
    rmSync(STOP_FILE, { force: true });
  }
  return { round: p.round, report, results };
};

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  runNight().then(
    () => process.exit(0),
    (error) => {
      console.error(`night: ${error.stack ?? error}`);
      process.exit(1);
    },
  );
}
