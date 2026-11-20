import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { nightStages, readRuns } from './map.mjs';
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

describe('readRuns', () => {
  it('lists every live run with its own stages, then the last finished', () => {
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
    writeStatus(41, { step: 'review', areas: ['a'], nightDir: night(41, ['review 1/2 a A on studio: 0 findings']) }, state);
    writeStatus(42, { step: 'fleet', areas: ['b'], nightDir: night(42, ['patch b: 1 commits on audit42-b']) }, state);
    const runs = readRuns(state);
    expect(runs.map((r) => [r.round, r.running, r.step, r.areas, r.stages])).toEqual([
      [41, true, 'review', ['a'], { a: 'reviewing' }],
      [42, true, 'fleet', ['b'], { b: 'patched' }],
      [40, false, 'done', ['old'], {}],
    ]);
  });
});
