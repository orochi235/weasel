/**
 * The audit map's data: every area of the partition with its passes, whether it is settled, where it sits in
 * the queue, and how far the live run holding it has taken it. `node scripts/skulk/map.mjs [--out <file>]` prints or
 * writes the JSON the audit map page reads.
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gitIn } from './batch.mjs';
import { STATE_DIR } from './config.mjs';
import { partitionAt } from './partition.mjs';
import { chapman, gitTouched, pickAreas, readPasses } from './rounds.mjs';
import { lastFinished, liveRuns } from './runs.mjs';

/** Each area's furthest step in a night's log, from the lines `night.mjs` prints as jobs finish. */
export const nightStages = (log) => {
  const stages = new Map();
  const reviews = new Map();
  const set = (id, stage) => stages.set(id, stage);
  for (const line of log.split('\n')) {
    let m;
    if ((m = /^review \d+\/\d+ (\S+) [AB] /.exec(line))) {
      const n = (reviews.get(m[1]) ?? 0) + 1;
      reviews.set(m[1], n);
      set(m[1], n >= 2 ? 'reviewed' : 'reviewing');
    } else if ((m = /^match \d+\/\d+ (\S+):/.exec(line))) set(m[1], 'matched');
    else if ((m = /^fix \d+\/\d+ (\S+) on /.exec(line))) set(m[1], 'fixed');
    else if ((m = /^patch (\S+): /.exec(line))) set(m[1], 'patched');
    else if ((m = /^batch: audit\d+-(\S+) conflicts/.exec(line))) set(m[1], 'conflict');
  }
  return stages;
};

/** What one run, live (`running`) or finished, says about its areas. */
export const readRun = (run, running) => {
  const logPath = run.nightDir ? join(run.nightDir, 'night.log') : null;
  const log = logPath && existsSync(logPath) ? readFileSync(logPath, 'utf8') : '';
  const lines = log.split('\n').filter(Boolean);
  return {
    running,
    round: run.round,
    started: run.started,
    ended: run.ended ?? null,
    step: running ? run.step : 'done',
    costUsd: run.costUsd ?? 0,
    capUsd: run.capUsd ?? null,
    report: run.report ?? null,
    areas: run.areas?.map((a) => (typeof a === 'string' ? a : a.id)) ?? [],
    stages: Object.fromEntries(nightStages(log)),
    lastLine: lines.at(-1) ?? null,
  };
};

/** Every live run, then the one that finished last. */
export const readRuns = (state = STATE_DIR) => {
  const last = lastFinished(state);
  return [...liveRuns(state).map((r) => readRun(r, true)), ...(last ? [readRun(last, false)] : [])];
};

export const buildMap = (root) => {
  const git = gitIn(root);
  const head = git('rev-parse', '--short', 'HEAD');
  const areas = partitionAt(root, 'HEAD');
  const passes = readPasses(root);
  const { picked, settled } = pickAreas({ areas, passes, touched: gitTouched(git), count: Infinity });
  const queue = new Map(picked.map((id, i) => [id, i + 1]));
  const settledSet = new Set(settled);
  const runs = readRuns();
  /** The live run holding each area. */
  const holder = new Map(runs.filter((r) => r.running).flatMap((r) => r.areas.map((id) => [id, r])));

  const out = areas.map((area) => {
    const history = (passes.get(area.id) ?? []).map((p) => {
      const est = chapman(p.a, p.b, p.m);
      return { round: p.round, date: p.date, a: p.a, b: p.b, shared: p.m, distinct: p.distinct, est: Math.round(est * 10) / 10, left: Math.max(0, Math.round((est - p.distinct) * 10) / 10) };
    });
    const run = holder.get(area.id);
    const status = run ? 'tonight' : settledSet.has(area.id) ? 'settled' : history.length ? 'due' : 'unaudited';
    return {
      id: area.id,
      group: area.id.split('.')[0],
      files: area.files.length,
      status,
      queue: queue.get(area.id) ?? null,
      passes: history,
      stage: run ? run.stages[area.id] ?? 'queued' : null,
    };
  });

  const rounds = new Map();
  for (const a of out) {
    for (const p of a.passes) {
      const r = rounds.get(p.round) ?? { round: p.round, date: p.date, areas: 0, files: 0, distinct: 0, est: 0 };
      r.areas += 1;
      r.files += a.files;
      r.distinct += p.distinct;
      r.est += p.est;
      rounds.set(p.round, r);
    }
  }

  return {
    generated: new Date().toISOString(),
    head,
    runs,
    areas: out,
    rounds: [...rounds.values()].sort((x, y) => x.round - y.round).map((r) => ({ ...r, est: Math.round(r.est) })),
  };
};

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const root = process.env.WEASEL_ROOT ?? process.cwd();
  const at = process.argv.indexOf('--out');
  const json = JSON.stringify(buildMap(root));
  if (at > 0) writeFileSync(process.argv[at + 1], json);
  else process.stdout.write(json + '\n');
}
