/**
 * The audit map's data: every area of the partition with its passes, whether it is settled, where it sits in
 * the queue, and how far the live run holding it has taken it. `node scripts/skulk/map.mjs [--out <file>]` prints or
 * writes the JSON the audit map page reads.
 */
import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gitIn } from './batch.mjs';
import { STATE_DIR } from './config.mjs';
import { fixTallyOf } from './findings.mjs';
import { partitionAt } from './partition.mjs';
import { chapman, gitTouched, pickAreas, readPasses } from './rounds.mjs';
import { lastFinished, liveRuns, readJson } from './runs.mjs';

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

/** The finished onto job that most likely ran a step the log says took `minutes`: the one whose run is nearest that. */
const bestFinished = (jobs, minutes) => {
  const took = (j) => (Date.parse(j.finished) - Date.parse(j.started)) / 60_000;
  const off = (j) => (minutes === undefined ? -Date.parse(j.finished) : Math.abs(took(j) - minutes));
  return [...jobs].sort((x, y) => off(x) - off(y))[0];
};

/**
 * Each area's lane: for every step of its thread (reviews A and B, match, fix, patch), whether it is done,
 * with what the log says it produced, or running, from `jobs`' `audit<N>-<area>-<step>` onto tasks. A job with
 * no `finished` is running, and gives its step's `since`; a finished one gives a done step its `ended`, and its
 * `started` as that less the minutes the log reports. A done fix takes its report's tally from `reports`, by area.
 */
export const nightLanes = (log, areas, jobs = [], reports = new Map()) => {
  const lanes = new Map(areas.map((id) => [id, Object.fromEntries(LANE_STEPS.map((s) => [s, { state: 'waiting' }]))]));
  const at = (id, step) => lanes.get(id)?.[step];
  for (const line of log.split('\n')) {
    let m;
    if ((m = /^review \d+\/\d+ (\S+) ([AB]) on (\S+): (\d+) findings, (\d+)\/(\d+) files read, ([\d.]+) min/.exec(line))) {
      Object.assign(at(m[1], m[2]) ?? {}, { state: 'done', node: m[3], findings: Number(m[4]), read: Number(m[5]), files: Number(m[6]), minutes: Number(m[7]) });
    } else if ((m = /^match \d+\/\d+ (\S+): (\d+) shared of (\d+) \+ (\d+)/.exec(line))) {
      Object.assign(at(m[1], 'match') ?? {}, { state: 'done', shared: Number(m[2]), a: Number(m[3]), b: Number(m[4]) });
    } else if ((m = /^fix \d+\/\d+ (\S+) on (\S+): (\d+) commits, ([\d.]+) min/.exec(line))) {
      const tally = fixTallyOf(reports.get(m[1]) ?? '');
      Object.assign(at(m[1], 'fix') ?? {}, { state: 'done', node: m[2], commits: Number(m[3]), minutes: Number(m[4]), ...(tally ?? {}) });
    } else if ((m = /^patch (\S+): (\d+) commits on /.exec(line))) {
      Object.assign(at(m[1], 'patch') ?? {}, { state: 'done', commits: Number(m[2]) });
    } else if ((m = /^patch (\S+): did not apply/.exec(line))) {
      Object.assign(at(m[1], 'patch') ?? {}, { state: 'failed', why: 'did not apply' });
    } else if ((m = /^batch: audit\d+-(\S+) conflicts/.exec(line))) {
      Object.assign(at(m[1], 'patch') ?? {}, { state: 'failed', why: 'conflicts; left out of the batch' });
    }
  }
  const finished = new Map();
  for (const job of jobs) {
    const m = /^(?:audit|skulk)\d+-(.+)-(A|B|match|fix)$/.exec(job.task ?? '');
    const step = m && at(m[1], m[2]);
    if (!step) continue;
    if (job.finished) {
      const key = `${m[1]}\n${m[2]}`;
      finished.set(key, [...(finished.get(key) ?? []), job]);
    } else if (step.state === 'waiting') Object.assign(step, { state: 'running', node: job.node, since: job.started });
  }
  for (const [key, ran] of finished) {
    const [id, name] = key.split('\n');
    const step = at(id, name);
    if (step.state !== 'done') continue;
    const job = bestFinished(ran, step.minutes);
    const ended = Date.parse(job.finished);
    const started = step.minutes === undefined ? Date.parse(job.started) : ended - step.minutes * 60_000;
    Object.assign(step, { started: new Date(started).toISOString(), ended: new Date(ended).toISOString() });
  }
  return [...lanes].map(([id, steps]) => ({ id, steps }));
};

/** The onto jobs running now or started since `since` (an ISO time), or none when onto cannot be asked. */
const ontoJobs = (since) => {
  const hours = Math.max(1, Math.ceil((Date.now() - Date.parse(since)) / 3_600_000) + 1);
  try {
    const out = execFileSync('onto', ['jobs', '--json', '--since', `${Number.isFinite(hours) ? hours : 24}h`, '--limit', '1000'],
      { encoding: 'utf8', timeout: 20_000, stdio: ['ignore', 'pipe', 'ignore'] });
    return (JSON.parse(out).jobs ?? []).filter((j) => j.state === 'running' || j.finished);
  } catch {
    return [];
  }
};

/** A run's night directory: the one its record names, or else the one `night.mjs` named for its round. */
const nightDirOf = (run, state) => {
  if (run.nightDir) return run.nightDir;
  const nights = join(state, 'nights');
  if (!existsSync(nights)) return null;
  const name = readdirSync(nights).filter((n) => n.endsWith(`-round${run.round}`)).sort().at(-1);
  return name ? join(nights, name) : null;
};

/** Each area's fixer report that has come home, by area. */
const fixReports = (nightDir, ids) => new Map(nightDir ? ids.flatMap((id) => {
  const file = join(nightDir, 'jobs', id, 'fix', 'claude.json');
  return existsSync(file) ? [[id, String(readJson(file)?.result ?? '')]] : [];
}) : []);

/** What one run, live (`running`) or finished, says about its areas; `jobs` are onto's jobs, running and finished. */
export const readRun = (found, running, jobs = [], state = STATE_DIR) => {
  const run = { ...found, nightDir: nightDirOf(found, state) };
  const logPath = run.nightDir ? join(run.nightDir, 'night.log') : null;
  const log = logPath && existsSync(logPath) ? readFileSync(logPath, 'utf8') : '';
  const lines = log.split('\n').filter(Boolean);
  const areaIds = run.areas?.map((a) => (typeof a === 'string' ? a : a.id)) ?? [];
  const own = jobs.filter((j) => new RegExp(`^(audit|skulk)${run.round}-`).test(j.task ?? ''));
  return {
    running,
    round: run.round,
    started: run.started,
    ended: run.ended ?? null,
    step: running ? run.step : 'done',
    costUsd: run.costUsd ?? 0,
    capUsd: run.capUsd ?? null,
    report: run.report ?? null,
    areas: areaIds,
    stages: Object.fromEntries(nightStages(log)),
    lanes: nightLanes(log, areaIds, running ? own : own.filter((j) => j.finished), fixReports(run.nightDir, areaIds)),
    sweepRunning: running && jobs.some((j) => !j.finished && /control-sweep$/.test(j.task ?? '')),
    nightDir: run.nightDir ?? null,
    lastLine: lines.at(-1) ?? null,
    lines: lines.slice(-40),
  };
};

/** Every live run, then the one that finished last. */
export const readRuns = (state = STATE_DIR, jobs = null) => {
  const legacy = !existsSync(join(state, 'runs'));
  const current = legacy ? readJson(join(state, 'current.json')) : null;
  // A service still on the one-night runner keeps current.json and last.json instead of runs/.
  const lastJson = legacy ? readJson(join(state, 'last.json')) : null;
  const last = legacy ? (lastJson && lastJson.round !== current?.round ? lastJson : null) : lastFinished(state);
  const live = legacy ? (current ? [current] : []) : liveRuns(state);
  const all = [...live, ...(last ? [last] : [])];
  const since = all.map((r) => r.started).filter(Boolean).sort()[0];
  const known = all.length ? (jobs ?? (since ? ontoJobs(since) : [])) : [];
  return [...live.map((r) => readRun(r, true, known, state)), ...(last ? [readRun(last, false, known, state)] : [])];
};

/**
 * What a run's night directory holds of each area it finished: `areas/<id>/match.json` (each reviewer's claims and
 * the pairs matched across them) and `files.txt`, the fields its `area.json` is made from.
 */
export const nightResults = (nightDir) => {
  const dir = nightDir ? join(nightDir, 'areas') : null;
  if (!dir || !existsSync(dir)) return [];
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const matchPath = join(dir, entry.name, 'match.json');
    if (!entry.isDirectory() || !existsSync(matchPath)) return [];
    const match = readJson(matchPath);
    if (!match) return [];
    const filesPath = join(dir, entry.name, 'files.txt');
    const files = existsSync(filesPath) ? readFileSync(filesPath, 'utf8').split('\n').filter(Boolean).length : 0;
    const [a, b, m] = [match.a?.length ?? 0, match.b?.length ?? 0, match.pairs?.length ?? 0];
    return [{ id: entry.name, files, a, b, m, distinct: a + b - m, est: chapman(a, b, m) }];
  });
};

/** A run's bar on the rounds chart, from its night directory: `pending` says it is `live` or `unmerged`. Null for a
 *  run that has finished no area. */
export const nightRoundOf = (run) => {
  const results = nightResults(run.nightDir);
  if (results.length === 0) return null;
  const sum = (key) => results.reduce((n, r) => n + r[key], 0);
  return {
    round: run.round, date: (run.started ?? '').slice(0, 10), areas: results.length,
    files: sum('files'), distinct: sum('distinct'), est: sum('est'), pending: run.running ? 'live' : 'unmerged',
  };
};

/**
 * Every round's night directory under `state`'s `nights/` (`<started>-round<N>`), the latest where a round has more
 * than one, each `running` while a live run in `runs` holds its round.
 */
export const nightsOf = (runs, state = STATE_DIR) => {
  const dir = join(state, 'nights');
  if (!existsSync(dir)) return [];
  const live = new Set(runs.filter((r) => r.running).map((r) => r.round));
  const latest = new Map();
  for (const name of readdirSync(dir).sort()) {
    const m = /^(\d{4}-\d{2}-\d{2})T.*-round(\d+)$/.exec(name);
    if (m) latest.set(Number(m[2]), { round: Number(m[2]), started: m[1], nightDir: join(dir, name), running: live.has(Number(m[2])) });
  }
  return [...latest.values()];
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

  // A round whose record is not on this branch yet is drawn from its night directory, marked as such.
  for (const night of nightsOf(runs)) {
    const bar = rounds.has(night.round) ? null : nightRoundOf(night);
    if (bar) rounds.set(night.round, bar);
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
