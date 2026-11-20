import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { nightLanes, nightRoundOf, nightStages, nightsOf, readRuns, withPasses } from './map.mjs';
import { claimRound, writeStatus, writeSummary } from './runs.mjs';

const dirs: string[] = [];
afterEach(() => {
  for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true });
});

describe('nightStages', () => {
  it('takes each area to the furthest step its log lines reach', () => {
    const log = [
      'control sweep: 0 dead, 19 unsure, 1086 skipped of 2503 controls in 180 demos, 29.4 min',
      'review 1/16 apps.chart A on studio: 0 findings, 3/3 files read, 3.4 min, 0.54M tokens',
      'review 2/16 apps.chart B on studio: 1 findings, 3/3 files read, 3.5 min, 0.58M tokens',
      'review 3/16 core.core B on teitou: 5 findings, 35/35 files read, 3.8 min, 2.25M tokens',
      'match 1/8 apps.chart: 0 shared of 0 + 1',
      'fix 1/8 apps.chart on studio: 1 commits, 8.0 min, 0.79M tokens',
      'patch apps.chart: 1 commits on audit40-apps.chart',
      'review 4/16 core.canvas.part1 A on studio: 3 findings, 47/47 files read, 5.5 min, 5.79M tokens',
      'review 5/16 core.canvas.part1 B on studio: 3 findings, 47/47 files read, 13.7 min, 9.96M tokens',
      'patch core.canvas.part1: 6 commits on audit40-core.canvas.part1',
      'batch: audit40-core.canvas.part1 conflicts; left out',
    ].join('\n');
    expect(Object.fromEntries(nightStages(log))).toEqual({
      'apps.chart': 'patched',
      'core.core': 'reviewing',
      'core.canvas.part1': 'conflict',
    });
  });
});

describe('nightLanes', () => {
  it('counts a match done, nothing shared, when one reviewer found nothing', () => {
    const log = 'review 1/4 p A on studio: 1 findings, 12/12 files read, 3.0 min\nreview 2/4 p B on teitou: 0 findings, 12/12 files read, 5.3 min';
    expect(nightLanes(log, ['p'])[0]!.steps.match).toMatchObject({ state: 'done', shared: 0, a: 1, b: 0 });
  });

  it('gives a done fix its report\'s tally, and leaves one with no tally as it was', () => {
    const log = 'fix 1/2 a on studio: 5 commits, 8.0 min, 0.5M weighted tokens\nfix 2/2 b on studio: 2 commits, 3.0 min, 0.2M weighted tokens';
    const lanes = nightLanes(log, ['a', 'b'], [], new Map([['a', 'tally: 3 of 4 fixed, 1 extra fixed'], ['b', 'A note about a watcher; nothing was lost.']]));
    expect(lanes.find((l) => l.id === 'a')!.steps.fix).toMatchObject({ commits: 5, fixed: 3, of: 4, extra: 1 });
    expect(lanes.find((l) => l.id === 'b')!.steps.fix).not.toHaveProperty('fixed');
  });

  it("fills each area's thread from the log, and marks a step running from onto's running tasks", () => {
    const log = [
      'review 1/4 core.core.ops A on studio: 5 findings, 24/24 files read, 2.8 min, 1.30M tokens',
      'review 2/4 core.core.ops B on teitou: 2 findings, 24/24 files read, 2.9 min, 1.66M tokens',
      'match 1/2 core.core.ops: 2 shared of 5 + 2',
    ].join('\n');
    const running = [{ task: 'audit41-core.core.ops-fix', node: 'studio', started: '2026-11-19T21:00:00Z' }, { task: 'audit41-core.debug-A', node: 'teitou', started: '2026-11-19T21:01:00Z' }];
    const [ops, debug] = nightLanes(log, ['core.core.ops', 'core.debug'], running);
    expect(ops.steps.A).toEqual({ state: 'done', node: 'studio', findings: 5, read: 24, files: 24, minutes: 2.8 });
    expect(ops.steps.match).toEqual({ state: 'done', shared: 2, a: 5, b: 2 });
    expect(ops.steps.fix).toEqual({ state: 'running', node: 'studio', since: '2026-11-19T21:00:00Z' });
    expect(ops.steps.patch.state).toBe('waiting');
    expect(debug.steps.A.state).toBe('running');
    expect(debug.steps.B.state).toBe('waiting');
  });

  it("times a done step from onto's finished job nearest its logged minutes, ending when that job did", () => {
    const log = 'review 1/2 core.core.ops A on studio: 5 findings, 24/24 files read, 3.0 min, 1.30M tokens';
    const jobs = [
      { task: 'audit41-core.core.ops-A', node: 'studio', started: '2026-11-19T21:00:00Z', finished: '2026-11-19T21:00:04Z' },
      { task: 'audit41-core.core.ops-A', node: 'studio', started: '2026-11-19T20:50:00Z', finished: '2026-11-19T20:53:10Z' },
    ];
    const [ops] = nightLanes(log, ['core.core.ops'], jobs);
    expect(ops.steps.A).toMatchObject({ state: 'done', minutes: 3, started: '2026-11-19T20:50:10.000Z', ended: '2026-11-19T20:53:10.000Z' });
    expect(ops.steps.B).toEqual({ state: 'waiting' });
  });

  it("fails a patch that did not apply", () => {
    const [ops] = nightLanes('patch core.core.ops: did not apply: conflict in a.ts', ['core.core.ops']);
    expect(ops.steps.patch).toEqual({ state: 'failed', why: 'did not apply' });
  });
});

describe('withPasses', () => {
  it('gives a matched lane the pass its round made of the area, and an unmatched one none', () => {
    const W = { state: 'waiting' };
    const matched = { id: 'a', steps: { A: W, B: W, match: { state: 'done', a: 7, b: 4, shared: 1 }, fix: W, patch: W } };
    const [a, b] = withPasses([matched, { id: 'b', steps: { A: W, B: W, match: W, fix: W, patch: W } }], { round: 47, started: '2026-11-20T14:11:24.920Z' });
    expect(a!.pass).toEqual({ round: 47, date: '2026-11-20', a: 7, b: 4, shared: 1, distinct: 10, est: 19, left: 9 });
    expect(b).not.toHaveProperty('pass');
  });
});

describe('nightRoundOf', () => {
  it("finds a run's night directory by its round where its record names none", () => {
    const state = mkdtempSync(join(tmpdir(), 'skulk-map-'));
    dirs.push(state);
    mkdirSync(join(state, 'nights', '2026-11-20T01-31-25-262Z-round41'), { recursive: true });
    writeFileSync(join(state, 'last.json'), JSON.stringify({ round: 41, started: 's', ended: 'e', areas: [] }));
    expect(readRuns(state, [])[0]!.nightDir).toBe(join(state, 'nights', '2026-11-20T01-31-25-262Z-round41'));
  });

  it('finds every round in the nights directory, the latest night of each, live where a run still holds it', () => {
    const state = mkdtempSync(join(tmpdir(), 'skulk-map-'));
    dirs.push(state);
    for (const name of ['2026-11-19T22-49-35-217Z-round40', '2026-11-20T03-23-24-845Z-round42', '2026-11-20T04-00-00-000Z-round42', 'scratch']) {
      mkdirSync(join(state, 'nights', name), { recursive: true });
    }
    expect(nightsOf([{ round: 42, running: true }], state)).toEqual([
      { round: 40, started: '2026-11-19', nightDir: join(state, 'nights', '2026-11-19T22-49-35-217Z-round40'), running: false },
      { round: 42, started: '2026-11-20', nightDir: join(state, 'nights', '2026-11-20T04-00-00-000Z-round42'), running: true },
    ]);
    expect(nightsOf([], join(state, 'missing'))).toEqual([]);
  });

  it("draws a round with no committed record from its night directory's finished areas", () => {
    const nightDir = mkdtempSync(join(tmpdir(), 'skulk-night-'));
    dirs.push(nightDir);
    const area = (id: string, a: number, b: number, pairs: number, files: number) => {
      mkdirSync(join(nightDir, 'areas', id), { recursive: true });
      writeFileSync(join(nightDir, 'areas', id, 'match.json'), JSON.stringify({ pairs: Array(pairs).fill([0, 0]), a: Array(a).fill('x'), b: Array(b).fill('y') }));
      writeFileSync(join(nightDir, 'areas', id, 'files.txt'), `${Array(files).fill('f.ts').join('\n')}\n`);
    };
    area('core.ops', 5, 2, 2, 24);
    area('geom', 3, 3, 3, 10);
    mkdirSync(join(nightDir, 'areas', 'cursor'));
    const bar = nightRoundOf({ round: 42, running: true, started: '2026-11-20T03:23:24Z', nightDir });
    expect(bar).toMatchObject({ round: 42, date: '2026-11-20', areas: 2, files: 34, distinct: 8, pending: 'live' });
    expect(bar.est).toBeCloseTo(5 + 3);
    expect(nightRoundOf({ round: 41, running: false, nightDir })?.pending).toBe('unmerged');
    expect(nightRoundOf({ round: 40, running: false, nightDir: null })).toBeNull();
  });
});

describe('readRuns', () => {
  it('lists every live run with its own stages, lanes and lines, then the last finished', () => {
    const state = mkdtempSync(join(tmpdir(), 'skulk-map-'));
    dirs.push(state);
    const night = (round: number, lines: string[]) => {
      const dir = join(state, 'nights', `r${round}`);
      mkdirSync(dir, { recursive: true });
      writeFileSync(join(dir, 'night.log'), `${lines.join('\n')}\n`);
      return dir;
    };
    for (const round of [40, 41, 42]) claimRound(round, state);
    writeSummary(40, { round: 40, started: 's', ended: 'e', areas: [{ id: 'old' }], nightDir: night(40, []) }, state);
    writeStatus(41, { step: 'review', areas: ['a'], nightDir: night(41, ['review 1/2 a A on studio: 0 findings, 3/3 files read, 1.0 min']) }, state);
    writeStatus(42, { step: 'fleet', areas: ['b'], nightDir: night(42, ['patch b: 1 commits on audit42-b']) }, state);
    const jobs = [{ task: 'audit41-a-B', node: 'teitou', started: 't' }, { task: 'audit42-a-B', node: 'studio', started: 'u' }];
    const runs = readRuns(state, jobs);
    expect(runs.map((r) => [r.round, r.running, r.step, r.areas, r.stages])).toEqual([
      [41, true, 'review', ['a'], { a: 'reviewing' }],
      [42, true, 'fleet', ['b'], { b: 'patched' }],
      [40, false, 'done', ['old'], {}],
    ]);
    expect(runs[0].lanes).toEqual([{ id: 'a', steps: {
      A: { state: 'done', node: 'studio', findings: 0, read: 3, files: 3, minutes: 1 },
      B: { state: 'running', node: 'teitou', since: 't' },
      match: { state: 'waiting' }, fix: { state: 'waiting' }, patch: { state: 'waiting' },
    } }]);
    expect(runs[1].lanes[0].steps.patch).toEqual({ state: 'done', commits: 1 });
    expect(runs[1].lines).toEqual(['patch b: 1 commits on audit42-b']);
    expect(runs[2].lanes).toEqual([{ id: 'old', steps: expect.objectContaining({ A: { state: 'waiting' } }) }]);
    expect(runs[2].nightDir).toBe(join(state, 'nights', 'r40'));
  });
});
