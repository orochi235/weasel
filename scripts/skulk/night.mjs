#!/usr/bin/env node
/**
 * One run of blind-pair audit rounds: one round with its parameters. Several may run at once.
 * README.md beside this file is its documentation.
 *
 *   node scripts/skulk/night.mjs [--areas K] [--only <id>,…] [--nodes <a>,…] [--dry] [--no-merge]
 *     [--cap-usd N] [--budget-review USD] [--budget-match USD] [--budget-fix USD] [--sweep]
 */
import { appendFileSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { runArea } from './area.mjs';
import { addWorktree, gitIn, removeWorktree } from './batch.mjs';
import {
  AREAS_PER_NIGHT, AREA_USD_GUESS, JOB_BUDGET_USD, JOB_IN, KEEP_NIGHTS, NIGHT_USD_CAP, REVIEW_SLOTS_PER_NODE, STATE_DIR, STOP_AT, nodesAt,
} from './config.mjs';
import { createSlots, unavailableNodes } from './jobs.mjs';
import { batchAndTest, patchAreas, patchSweep } from './land.mjs';
import { waitForLease } from './lease.mjs';
import { partitionAt } from './partition.mjs';
import { AUDITS_DIR, HARDENING, areasInFlight, gitTouched, nextRound, pickAreas, readPasses } from './rounds.mjs';
import { claimRound, claimedRounds, clearStatus, liveRuns, planLock, pruneRuns, readJson, runDir, stopRequested, writeStatus, writeSummary } from './runs.mjs';
import { SWEEP_ID, fixSweep, runControlSweep, sweepLine } from './sweep.mjs';
import { mayStartArea } from './usage.mjs';

const POLL_MS = 15_000;
const UNAVAILABLE_TTL_MS = 5 * 60_000;

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
    resume: value('--resume') === undefined ? undefined : number('--resume', 0),
    merge: !argv.includes('--no-merge'),
    sweep: argv.includes('--sweep'),
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

/** What a run started now would do. Its round is the next unclaimed one; areas a live run holds are left out. */
const plan = (root, args) => {
  const git = gitIn(root);
  const commit = git('rev-parse', 'main');
  const branches = git('for-each-ref', '--format=%(refname:short)', 'refs/heads').split('\n');
  const roundDirs = existsSync(join(root, AUDITS_DIR)) ? readdirSync(join(root, AUDITS_DIR)) : [];
  const round = nextRound({ roundDirs, hardening: readFileSync(join(root, HARDENING), 'utf8'), branches, claimed: claimedRounds() });
  const areas = partitionAt(root, commit);
  const passes = readPasses(root);
  const running = liveRuns();
  const held = new Set(running.flatMap((r) => r.areas ?? []));
  const byId = new Map(areas.map((a) => [a.id, a]));
  const unknown = (args.only ?? []).filter((id) => !byId.has(id));
  if (unknown.length > 0) throw new Error(`no area named ${unknown.join(', ')}; see docs/audits/partition.json`);
  const taken = (args.only ?? []).filter((id) => held.has(id));
  if (taken.length > 0) throw new Error(`${taken.join(', ')} ${taken.length === 1 ? 'is' : 'are'} held by a live run; see its status`);
  const picked = args.only
    ? args.only.slice(0, args.areas)
    : pickAreas({
      areas, passes, touched: gitTouched(git), count: args.areas,
      inFlight: new Set([...areasInFlight(git('for-each-ref', '--no-merged=main', '--format=%(refname:short)', 'refs/heads').split('\n')), ...held]),
    }).picked;
  return { commit, round, picked: picked.map((id) => byId.get(id)), passes, running };
};

const printPlan = (p, args, say) => {
  say(`round ${p.round} at ${p.commit.slice(0, 10)}; nodes: ${(args.nodes ?? nodesAt(new Date())).join(', ')}${args.nodes ? ' (pinned)' : ''}; stops dispatching at ${STOP_AT}`);
  say(`budget: ${usd(args.capUsd)} tonight; per job $${args.budget.review} review, $${args.budget.match} match, $${args.budget.fix} fix`);
  for (const area of p.picked) {
    const last = p.passes.get(area.id)?.at(-1);
    say(`  ${area.id}: ${area.files.length} files${last ? `, last pass round ${last.round} (${last.distinct} distinct, ~${last.unfound} left)` : ', never audited'}`);
    say(`    ${area.files.slice(0, 4).join(' ')}${area.files.length > 4 ? ' …' : ''}`);
  }
  say(args.sweep ? 'control sweep: one browser job at the frozen commit beside the reviews, and a fixer for what it finds dead' : 'control sweep: off (it runs only with --sweep)');
  say(`jobs: ${p.picked.length * 2} reviews, up to ${p.picked.length} matches and ${p.picked.length} fixes; then batch/${localDate()}-audit${p.round}`);
  for (const r of p.running) say(`round ${r.round} is running (pid ${r.pid}, step ${r.step}); its areas are left out above`);
};

/**
 * Plans, claims the round and writes the run's first status, all under the plan lock, so two runs
 * starting at once never pick the same area. Answers the plan and the run's status, or the plan alone
 * when it picked nothing.
 */
const begin = async (root, args, say) => {
  const release = await waitForLease(planLock(), {}, { pollMs: 1_000 });
  try {
    const p = plan(root, args);
    if (p.picked.length === 0) {
      printPlan(p, args, say);
      return { p };
    }
    p.round = claimRound(p.round);
    printPlan(p, args, say);
    const started = new Date();
    const nightDir = join(STATE_DIR, 'nights', `${started.toISOString().replace(/[:.]/g, '-')}-round${p.round}`);
    mkdirSync(nightDir, { recursive: true });
    const status = { round: p.round, commit: p.commit, started: started.toISOString(), step: 'freeze', areas: p.picked.map((a) => a.id), nightDir, tokens: 0, costUsd: 0, capUsd: args.capUsd, args };
    writeStatus(p.round, status);
    return { p, status, started };
  } finally {
    release();
  }
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

/** The sweep's part of the night's summary. */
const sweepSummary = (sweep, outcomes) => (sweep.ran
  ? { ...sweep.summary, minutes: Number(sweep.minutes.toFixed(1)), exit: sweep.exit, fixCommits: sweep.fix?.commits.length ?? 0, outcome: outcomes[SWEEP_ID] }
  : { skipped: sweep.skipped ?? `did not run: ${sweep.why}` });

/** What every job of the run reads: its round, trees, budget, logging, and the slots it takes jobs in. */
const runContext = ({ root, p, args, status, frozen, say, setStep }) => {
  const git = gitIn(root);
  const slots = createSlots(args.nodes, { about: { round: p.round } });
  let unavailable = { at: 0, nodes: new Set() };
  const counts = {};
  return {
    round: p.round, commit: p.commit, date: localDate(new Date(status.started)), frozen, nightDir: status.nightDir, budget: args.budget,
    base: git('merge-base', p.commit, 'origin/main'),
    frozenTree: git('rev-parse', `${p.commit}^{tree}`),
    identity: Object.fromEntries(['NAME', 'EMAIL'].flatMap((k) => {
      const v = git('config', `user.${k.toLowerCase()}`);
      return [[`GIT_AUTHOR_${k}`, v], [`GIT_COMMITTER_${k}`, v]];
    })),
    total: { review: p.picked.length * 2, match: p.picked.length, fix: p.picked.length },
    stopped: () => stopRequested(p.round),
    say,
    progress: (kind, msg, total) => say(`${kind} ${(counts[kind] = (counts[kind] ?? 0) + 1)}/${total} ${msg}`),
    refuse: (node) => slots.refuse(node),
    usage: (record) => {
      appendFileSync(join(status.nightDir, 'usage.jsonl'), `${JSON.stringify({ round: p.round, ...record })}\n`);
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
};

/** The sweep, when asked for, beside the reviews. Answers a promise of its fixer's result; `onSweep` hears how it went. */
const startSweep = (ctx, onSweep) => runControlSweep(ctx).then(
  (ran) => {
    onSweep(ran);
    ctx.say(sweepLine(ran));
    if (!ran.dead?.length) return undefined;
    ctx.total.fix += 1;
    return fixSweep(ctx, ran.dead).catch((error) => {
      ctx.say(`fix ${SWEEP_ID} failed: ${error.stack ?? error}`);
      return undefined;
    });
  },
  (error) => {
    const failed = { ran: false, why: String(error.message ?? error) };
    onSweep(failed);
    ctx.say(sweepLine(failed));
    return undefined;
  },
);

/**
 * Picks a stopped or crashed round back up: its round, commit, areas and night directory, under the code and
 * settings on disk now. Jobs whose results came home are reused, not run again (`dispatch` in area.mjs).
 */
const resume = (root, args, say) => {
  const round = args.resume;
  const prior = readJson(join(runDir(round), 'status.json')) ?? readJson(join(runDir(round), 'summary.json'));
  if (!prior?.nightDir) throw new Error(`round ${round} left no status or summary to resume from`);
  if (liveRuns().some((r) => r.round === round)) throw new Error(`round ${round} is still running; stop it first`);
  const frozen = join(root, '.worktrees', `audit${round}-frozen-night`);
  const commit = prior.commit ?? (existsSync(frozen) ? gitIn(frozen)('rev-parse', 'HEAD') : undefined);
  if (!commit) throw new Error(`round ${round}'s commit is unknown: its status predates recording it and its frozen tree is gone`);
  const byId = new Map(partitionAt(root, commit).map((a) => [a.id, a]));
  // An area the stopped run already merged is done; the rest run again, reusing what came home.
  const landed = new Set((prior.areas ?? []).flatMap((a) => (typeof a === 'object' && /^`[^`]+`$/.test(a.outcome ?? '') ? [a.id] : [])));
  const ids = (prior.areas ?? []).map((a) => (typeof a === 'string' ? a : a.id)).filter((id) => !landed.has(id));
  const p = { commit, round, picked: ids.flatMap((id) => (byId.has(id) ? [byId.get(id)] : [])), passes: readPasses(root), running: liveRuns() };
  const started = new Date(prior.started);
  const status = { round, commit, started: prior.started, resumed: new Date().toISOString(), step: 'freeze', areas: ids, nightDir: prior.nightDir, tokens: 0, costUsd: 0, capUsd: args.capUsd, args };
  writeStatus(round, status);
  say(`resuming round ${round} at ${commit.slice(0, 10)}: ${p.picked.length} areas, reusing every job whose result came home`);
  return { p, status, started };
};

export const runNight = async (argv = process.argv.slice(2), say = (line) => console.log(line)) => {
  const args = parseArgs(argv);
  const root = mainCheckout();
  const git = gitIn(root);
  if (args.dry) {
    const p = plan(root, args);
    printPlan(p, args, say);
    return { round: p.round, dry: true };
  }
  mkdirSync(STATE_DIR, { recursive: true });
  const { p, status, started } = args.resume === undefined ? await begin(root, args, say) : resume(root, args, say);
  if (!status) return { round: p.round, dry: true };
  pruneNights();
  pruneRuns(KEEP_NIGHTS);
  const echo = say;
  say = (line) => {
    echo(line);
    appendFileSync(join(status.nightDir, 'night.log'), `${line}\n`);
  };
  const setStep = (step) => {
    status.step = step;
    writeStatus(p.round, status);
  };

  const results = [];
  const outcomes = {};
  let report = '';
  let sweep = { skipped: 'off (it runs only with --sweep)' };
  let frozen;
  try {
    frozen = addWorktree(root, `audit${p.round}-frozen-night`, p.commit);
    const ctx = runContext({ root, p, args, status, frozen, say, setStep });
    mkdirSync(join(frozen, JOB_IN), { recursive: true });
    // The sweep is one browser job on one node; the reviews fill every other slot while it runs.
    const sweepFix = args.sweep ? startSweep(ctx, (s) => (sweep = s)) : Promise.resolve(undefined);
    setStep('review');
    await reviewAreas({ ctx, git, picked: p.picked, passes: p.passes, args, status, deadline: nextClock(started, STOP_AT), results });
    const sweepFixed = await sweepFix;
    if (results.length === 0 && !sweepFixed?.mbox) throw new Error('no area finished');
    results.sort((a, b) => (a.id < b.id ? -1 : 1));
    setStep('patch');
    const landing = { root, round: p.round, commit: p.commit, outcomes, say };
    const branches = patchAreas({ ...landing, nightDir: status.nightDir, results });
    if (sweepFixed) sweep.fix = patchSweep({ ...landing, fixed: sweepFixed, branches });
    setStep('batch');
    report = await batchAndTest({ ...landing, git, date: ctx.date, nightDir: status.nightDir, branches, results, sweep, merge: args.merge, setStep });
    say(`night: ${report}`);
  } finally {
    if (frozen) removeWorktree(root, frozen);
    writeSummary(p.round, {
      round: p.round, commit: p.commit, started: status.started, ended: new Date().toISOString(), nightDir: status.nightDir, report,
      tokens: status.tokens, costUsd: status.costUsd, capUsd: args.capUsd, sweep: sweepSummary(sweep, outcomes),
      areas: results.map((s) => ({ id: s.id, a: s.a, b: s.b, m: s.m, distinct: s.distinct, chapman: s.chapman, patches: s.patches, outcome: outcomes[s.id], minutes: s.jobs.minutes, tokens: s.jobs.tokens, costUsd: s.jobs.costUsd, budgetHit: s.budgetHit })),
    });
    clearStatus(p.round);
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
