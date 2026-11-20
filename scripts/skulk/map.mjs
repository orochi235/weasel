/**
 * The audit map's data: every area of the partition with its passes, whether it is settled, where it sits in
 * the queue, and how far tonight's night has taken it. `node scripts/skulk/map.mjs [--out <file>]` prints or
 * writes the JSON the audit map page reads.
 */
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gitIn } from './batch.mjs';
import { partitionAt } from './partition.mjs';
import { chapman, gitTouched, pickAreas, readPasses } from './rounds.mjs';

const STATE = process.env.SKULK_STATE ?? join(homedir(), '.local/state/weasel-skulk');

const readJson = (path) => {
  try {
    return JSON.parse(readFileSync(path, 'utf8'));
  } catch {
    return null;
  }
};

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

const LANE_STEPS = ['A', 'B', 'match', 'fix', 'patch'];

/**
 * Each area's lane: for every step of its thread (reviews A and B, match, fix, patch), whether it is done,
 * with what the log says it produced, or running, from `running`'s `audit<N>-<area>-<step>` onto tasks.
 */
export const nightLanes = (log, areas, running = []) => {
  const lanes = new Map(areas.map((id) => [id, Object.fromEntries(LANE_STEPS.map((s) => [s, { state: 'waiting' }]))]));
  const at = (id, step) => lanes.get(id)?.[step];
  for (const line of log.split('\n')) {
    let m;
    if ((m = /^review \d+\/\d+ (\S+) ([AB]) on (\S+): (\d+) findings, (\d+)\/(\d+) files read, ([\d.]+) min/.exec(line))) {
      Object.assign(at(m[1], m[2]) ?? {}, { state: 'done', node: m[3], findings: Number(m[4]), read: Number(m[5]), files: Number(m[6]), minutes: Number(m[7]) });
    } else if ((m = /^match \d+\/\d+ (\S+): (\d+) shared of (\d+) \+ (\d+)/.exec(line))) {
      Object.assign(at(m[1], 'match') ?? {}, { state: 'done', shared: Number(m[2]), a: Number(m[3]), b: Number(m[4]) });
    } else if ((m = /^fix \d+\/\d+ (\S+) on (\S+): (\d+) commits, ([\d.]+) min/.exec(line))) {
      Object.assign(at(m[1], 'fix') ?? {}, { state: 'done', node: m[2], commits: Number(m[3]), minutes: Number(m[4]) });
    } else if ((m = /^patch (\S+): (\d+) commits on /.exec(line))) {
      Object.assign(at(m[1], 'patch') ?? {}, { state: 'done', commits: Number(m[2]) });
    } else if ((m = /^batch: audit\d+-(\S+) conflicts/.exec(line))) {
      Object.assign(at(m[1], 'patch') ?? {}, { state: 'failed', why: 'conflicts; left out of the batch' });
    }
  }
  for (const job of running) {
    const m = /^audit\d+-(.+)-(A|B|match|fix)$/.exec(job.task ?? '');
    const step = m && at(m[1], m[2]);
    if (step && step.state === 'waiting') Object.assign(step, { state: 'running', node: job.node, since: job.started });
  }
  return [...lanes].map(([id, steps]) => ({ id, steps }));
};

/** The onto jobs running now, or none when onto cannot be asked. */
const runningJobs = () => {
  try {
    const out = execFileSync('onto', ['jobs', '--json'], { encoding: 'utf8', timeout: 15_000, stdio: ['ignore', 'pipe', 'ignore'] });
    return (JSON.parse(out).jobs ?? []).filter((j) => j.state === 'running');
  } catch {
    return [];
  }
};

/** What the night that is running, or else the last one, says about tonight's areas. */
const readNight = () => {
  const current = readJson(join(STATE, 'current.json'));
  const last = readJson(join(STATE, 'last.json'));
  const night = current ?? last;
  if (!night) return null;
  const logPath = night.nightDir ? join(night.nightDir, 'night.log') : null;
  const log = logPath && existsSync(logPath) ? readFileSync(logPath, 'utf8') : '';
  const lines = log.split('\n').filter(Boolean);
  const areaIds = night.areas?.map((a) => (typeof a === 'string' ? a : a.id)) ?? [];
  const jobs = current ? runningJobs() : [];
  return {
    running: current !== null,
    round: night.round,
    started: night.started,
    ended: night.ended ?? null,
    step: current ? night.step : 'done',
    costUsd: night.costUsd ?? 0,
    capUsd: night.capUsd ?? null,
    report: night.report ?? null,
    areas: areaIds,
    stages: Object.fromEntries(nightStages(log)),
    lanes: nightLanes(log, areaIds, jobs),
    sweepRunning: jobs.some((j) => /control-sweep$/.test(j.task ?? '')),
    lastLine: lines.at(-1) ?? null,
    lines: lines.slice(-40),
  };
};

export const buildMap = (root) => {
  const git = gitIn(root);
  const head = git('rev-parse', '--short', 'HEAD');
  const areas = partitionAt(root, 'HEAD');
  const passes = readPasses(root);
  const { picked, settled } = pickAreas({ areas, passes, touched: gitTouched(git), count: Infinity });
  const queue = new Map(picked.map((id, i) => [id, i + 1]));
  const settledSet = new Set(settled);
  const night = readNight();
  const tonight = new Set(night?.running ? night.areas : []);

  const out = areas.map((area) => {
    const history = (passes.get(area.id) ?? []).map((p) => {
      const est = chapman(p.a, p.b, p.m);
      return { round: p.round, date: p.date, a: p.a, b: p.b, shared: p.m, distinct: p.distinct, est: Math.round(est * 10) / 10, left: Math.max(0, Math.round((est - p.distinct) * 10) / 10) };
    });
    const status = tonight.has(area.id) ? 'tonight' : settledSet.has(area.id) ? 'settled' : history.length ? 'due' : 'unaudited';
    return {
      id: area.id,
      group: area.id.split('.')[0],
      files: area.files.length,
      status,
      queue: queue.get(area.id) ?? null,
      passes: history,
      stage: tonight.has(area.id) ? night.stages[area.id] ?? 'queued' : null,
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
    night,
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
