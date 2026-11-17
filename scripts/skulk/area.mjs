/**
 * One area through a night: two blind reviews, the matcher, the estimate, and the fixer. Every raw file
 * lands in the area's directory under the night's state; `night.mjs` copies it into the round's record.
 * An area whose reviewers ran always gets its matcher and fixer, whatever the night's budget says.
 */
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { JOB_IN, JOB_OUT } from './config.mjs';
import { citedPaths, firstJson, matchPrompt, parseFilesRead, parseFindings, validPairs } from './findings.mjs';
import { fixShell, jobDir, matchShell, reviewShell, runJob } from './jobs.mjs';
import { chapman } from './rounds.mjs';
import { parseEnvelope, totals } from './usage.mjs';

const BRIEFS = new URL('./briefs/', import.meta.url);
const brief = (name) => readFileSync(new URL(name, BRIEFS), 'utf8');
const fill = (text, vars) => text.replace(/\{\{(\w+)\}\}/g, (_, k) => String(vars[k] ?? ''));
const readIf = (path) => (existsSync(path) ? readFileSync(path, 'utf8') : '');
const minutesSince = (t0) => (Date.now() - t0) / 60_000;
const round1 = (n) => Number(n.toFixed(1));
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
/** How many times a job that never reached its node is launched before its area is recorded incomplete. */
const LAUNCHES = 3;
const RELAUNCH_WAIT_MS = 60_000;
const cents = (n) => Number(n.toFixed(2));

/**
 * Runs one job on whichever slot frees first, moving to another node when one turns it away. Answers
 * where it ran, how long it took, the model's reply, and the job's usage record (also passed to
 * `ctx.usage`, which counts it against the night and logs it).
 */
const dispatch = async (ctx, area, role, spec) => {
  for (let launches = 1; ; launches++) {
    const slot = await ctx.acquire(role === 'fix' ? 'fix' : 'review');
    const t0 = Date.now();
    let result;
    try {
      result = await runJob({ ...spec, frozen: ctx.frozen, base: ctx.base, slot });
    } finally {
      slot.release();
    }
    if (result.refused) {
      ctx.refuse(slot.node);
      ctx.say(`${role} ${area.id} refused by ${slot.node}, trying another node`);
      continue;
    }
    const exit = readIf(join(spec.to, 'exit')).trim();
    // No exit file: the job never ran on the node, so there is no reply to read, only another launch to try.
    if (result.status !== 0 && !exit && launches < LAUNCHES) {
      ctx.say(`${role} ${area.id} did not launch on ${slot.node} (launch ${launches} of ${LAUNCHES}); trying again`);
      await sleep(RELAUNCH_WAIT_MS);
      continue;
    }
    const { reply, record } = parseEnvelope(readIf(join(spec.to, 'claude.json')));
    const usage = { area: area.id, role, node: slot.node, ...record, exit };
    ctx.usage(usage);
    if (usage.budgetHit) ctx.say(`${role} ${area.id} stopped at its $${ctx.budget[role.startsWith('review') ? 'review' : role]} ceiling`);
    return { status: result.status, launched: Boolean(exit), node: slot.node, minutes: minutesSince(t0), reply, usage };
  }
};

const review = async (ctx, area, side) => {
  const to = jobDir(ctx.nightDir, area.id, side);
  const run = await dispatch(ctx, area, `review-${side}`, {
    kind: 'review', expectMin: 30, shell: reviewShell(area.id, ctx.budget.review), to,
    task: `audit${ctx.round}-${area.id}-${side}`, logPath: join(to, '..', `${side}.log`),
    about: `Blind reviewer ${side} for audit round ${ctx.round}, area ${area.id}: reads its files and lists defects without fixing.`,
  });
  const text = readIf(join(to, 'findings.md')) || run.reply;
  const findings = parseFindings(text);
  const read = parseFilesRead(text).filter((f) => area.files.includes(f)).length;
  if (!run.launched) ctx.say(`review ${area.id} ${side}: never launched; the area is recorded incomplete`);
  ctx.progress('review', `${area.id} ${side} on ${run.node}: ${findings.length} findings, ${read}/${area.files.length} files read, ${run.minutes.toFixed(1)} min, ${(run.usage.totalTokens / 1e6).toFixed(2)}M tokens${run.usage.budgetHit ? ', hit its ceiling' : ''}`, ctx.total.review);
  return { text, findings, read, ...run };
};

const match = async (ctx, area, a, b) => {
  if (!a.launched || !b.launched || a.findings.length === 0 || b.findings.length === 0) return { pairs: [], minutes: 0 };
  writeFileSync(join(ctx.frozen, JOB_IN, area.id, 'match.md'), matchPrompt(brief('matcher.md'), a.findings, b.findings));
  const to = jobDir(ctx.nightDir, area.id, 'match');
  const run = await dispatch(ctx, area, 'match', {
    kind: 'review', expectMin: 2, shell: matchShell(area.id, ctx.budget.match), to,
    task: `audit${ctx.round}-${area.id}-match`, logPath: join(to, '..', 'match.log'),
    about: `Pairs the two blind reviewers' findings for audit round ${ctx.round}, area ${area.id}.`,
  });
  let pairs = [];
  try {
    pairs = validPairs(firstJson(run.reply).pairs, a.findings.length, b.findings.length);
  } catch (error) {
    ctx.say(`match ${area.id}: unreadable reply (${error.message}); counting no shared findings`);
  }
  ctx.progress('match', `${area.id}: ${pairs.length} shared of ${a.findings.length} + ${b.findings.length}`, ctx.total.match);
  return { pairs, ...run };
};

const fix = async (ctx, area) => {
  const to = jobDir(ctx.nightDir, area.id, 'fix');
  const vars = { round: ctx.round, area: area.id, commit: ctx.commit, reportA: `${JOB_IN}/${area.id}/A.md`, reportB: `${JOB_IN}/${area.id}/B.md` };
  writeFileSync(join(ctx.frozen, JOB_IN, area.id, 'fix.md'), fill(brief('fixer.md'), vars));
  const run = await dispatch(ctx, area, 'fix', {
    kind: 'fix', expectMin: 40, shell: fixShell(area.id, ctx.budget.fix), to,
    env: { FROZEN_TREE: ctx.frozenTree, ...ctx.identity },
    task: `audit${ctx.round}-${area.id}-fix`, logPath: join(to, '..', 'fix.log'),
    about: `Fixer for audit round ${ctx.round}, area ${area.id}: verifies, tests and fixes what the two reviewers found.`,
  });
  const mbox = join(to, 'fix.mbox');
  const patches = existsSync(mbox) ? (readFileSync(mbox, 'utf8').match(/^From [0-9a-f]{40} /gm) ?? []).length : 0;
  const mismatch = readIf(join(to, 'tree-mismatch')).trim();
  if (mismatch) ctx.say(`fix ${area.id}: ${mismatch}`);
  ctx.progress('fix', `${area.id} on ${run.node}: ${patches} commits, ${run.minutes.toFixed(1)} min, ${(run.usage.totalTokens / 1e6).toFixed(2)}M tokens${run.usage.budgetHit ? ', hit its ceiling' : ''}`, ctx.total.fix);
  return { mbox: patches > 0 ? mbox : undefined, patches, report: run.reply, ...run };
};

/**
 * The whole area. `previous` is its last pass, if any, and `changedSince` the files of the area that
 * changed after it. Answers the area's summary, which becomes its `area.json`.
 */
export const runArea = async (ctx, area, { previous, changedSince }) => {
  const inDir = join(ctx.frozen, JOB_IN, area.id);
  mkdirSync(inDir, { recursive: true });
  const vars = { round: ctx.round, area: area.id, commit: ctx.commit, out: `${JOB_OUT}/findings.md`, files: area.files.map((f) => `- ${f}`).join('\n') };
  writeFileSync(join(inDir, 'review.md'), fill(brief('reviewer.md'), vars));
  const [a, b] = await Promise.all([review(ctx, area, 'A'), review(ctx, area, 'B')]);
  const dir = join(ctx.nightDir, 'areas', area.id);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, 'files.txt'), `${area.files.join('\n')}\n`);
  for (const [name, text] of [['A.md', a.text], ['B.md', b.text]]) {
    writeFileSync(join(dir, name), text);
    writeFileSync(join(inDir, name), text);
  }
  const matched = await match(ctx, area, a, b);
  const claims = (fs) => fs.map((f) => f.claim);
  writeFileSync(join(dir, 'match.json'), `${JSON.stringify({ pairs: matched.pairs, a: claims(a.findings), b: claims(b.findings) }, null, 1)}\n`);
  const [na, nb, m] = [a.findings.length, b.findings.length, matched.pairs.length];
  const distinct = na + nb - m;
  // A side that never ran found nothing because it looked at nothing; an estimate from it would be invented.
  const incomplete = [a, b].flatMap((r, i) => (r.launched ? [] : [i === 0 ? 'A' : 'B']));
  const estimate = incomplete.length ? undefined : chapman(na, nb, m);
  const fixed = distinct > 0 ? await fix(ctx, area) : undefined;
  if (fixed?.report) writeFileSync(join(dir, 'fix.md'), fixed.report);
  if (fixed?.mbox) copyFileSync(fixed.mbox, join(dir, 'fix.mbox'));
  const changed = new Set(changedSince);
  const records = [a.usage, b.usage, matched.usage, fixed?.usage].filter(Boolean);
  const spent = totals(records);
  return {
    id: area.id, commit: ctx.commit, date: ctx.date, files: area.files,
    a: na, b: nb, m, distinct,
    ...(estimate === undefined ? { incomplete } : { chapman: round1(estimate), unfound: round1(estimate - distinct) }),
    read: { A: a.read, B: b.read },
    newCode: previous ? { since: previous.round, changedFiles: changed.size, findings: [...a.findings, ...b.findings].filter((f) => citedPaths(f).some((p) => changed.has(p))).length } : undefined,
    previous: previous ? { round: previous.round, chapman: previous.chapman, unfound: previous.unfound } : undefined,
    patches: fixed?.patches ?? 0,
    questions: (fixed?.report.match(/\bquestion\b/gi) ?? []).length,
    budgetHit: records.filter((r) => r.budgetHit).map((r) => r.role),
    jobs: {
      minutes: { A: round1(a.minutes), B: round1(b.minutes), match: round1(matched.minutes), fix: round1(fixed?.minutes ?? 0) },
      nodes: { A: a.node, B: b.node, fix: fixed?.node },
      tokens: spent.tokens,
      costUsd: cents(spent.costUsd),
    },
    fixCommits: [],
  };
};
