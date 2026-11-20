import { describe, expect, it } from 'vitest';
import { depthFor, nextUpOf, runHolding, statsFor, toneOf } from './areaData';
import { headlineOf, parseJob, recentJobsOf, sharedLaneOf, spendOf, stepText } from './runData';
import { ticksFor } from './RoundsChart';
import { inset, layoutMap, squarify } from './mapLayout';
import fixture from './fixture.map.json';
import type { SkulkMap } from './skulkMap.types';

const map = fixture as unknown as SkulkMap;
const [live, finished] = map.runs as [SkulkMap['runs'][0], SkulkMap['runs'][0]];
const now = Date.parse(map.generated);

describe('lanes', () => {
  it('says what each step of an area has done, or how long it has been running', () => {
    const ops = live.lanes[0]!;
    expect(stepText('A', ops.steps.A, now)).toBe('5 found · 2.8m');
    expect(stepText('match', ops.steps.match, now)).toBe('2 shared of 5+2');
    expect(stepText('fix', ops.steps.fix, now)).toBe('studio · 12m');
    expect(stepText('patch', ops.steps.patch, now)).toBe('after fix');
    expect(stepText('B', live.lanes[1]!.steps.B, now)).toBe('studio · <1m');
    expect(stepText('fix', { state: 'done', commits: 1, minutes: 7.6 }, now)).toBe('1 commit · 8m');
    expect(stepText('patch', { state: 'failed', why: 'conflicts; left out of the batch' }, now)).toBe('conflicts; left out of the batch');
  });

  it('gives the shared lane the batch while it runs, and the report once the run is done', () => {
    expect(sharedLaneOf(live)).toEqual({ state: 'waiting', text: 'batch, fleet run and merge, once every lane is patched' });
    expect(sharedLaneOf({ ...live, step: 'fleet' }).state).toBe('running');
    expect(sharedLaneOf(finished)).toEqual({ state: 'done', text: '8 areas merged; fleet green' });
  });

  it('heads each run with its round, step and spend', () => {
    expect(headlineOf(live)).toBe('Round 41 running · fix · 2 areas');
    expect(headlineOf(finished)).toBe('Round 40 finished · 8 areas merged');
    expect(spendOf(live)).toBe('$12.50 of $80');
    expect(spendOf({ ...live, capUsd: null })).toBe('$12.50');
  });
});

describe('jobs', () => {
  it('reads each kind of log line, and marks a review that skipped files', () => {
    expect(parseJob('review 3/4 core.debug A on teitou: 1 findings, 9/12 files read, 1.5 min, 0.40M tokens')).toEqual({
      kind: 'review', label: 'review A', area: 'core.debug', what: '1 finding, read 9 of 12 files',
      node: 'teitou', minutes: 1.5, tokens: 0.4, of: '3/4', bad: true,
    });
    expect(parseJob('batch: audit41-core.ops conflicts; left out')?.bad).toBe(true);
    expect(parseJob('fleet: 2 failed')).toMatchObject({ kind: 'fleet', bad: true });
    expect(parseJob('something else')).toBeNull();
  });

  it('lists every run, each newest first', () => {
    const jobs = recentJobsOf(map.runs);
    expect(jobs.map((j) => [j.round, j.job.label, j.job.area])).toEqual([
      [41, 'match', 'core.ops'],
      [41, 'review A', 'core.debug'],
      [41, 'review B', 'core.ops'],
      [41, 'review A', 'core.ops'],
      [41, 'night', ''],
      [40, 'fix', 'ui.badge'],
    ]);
  });
});

describe('areas', () => {
  it('shades by estimated defects left, settled and never-audited apart', () => {
    expect([0, 0.74, 0.75, 1.99, 2, 3.5, 5.99, 6, 40].map(depthFor)).toEqual([0, 0, 1, 1, 2, 3, 3, 4, 4]);
    expect(map.areas.map(toneOf)).toEqual([1, 'unaudited', 4, 'settled', 'unaudited', 1]);
  });

  it('sums the headline stats', () => {
    expect(statsFor(map.areas)).toEqual([
      { value: '4 / 6', label: 'areas audited at least once' },
      { value: '80%', label: 'of 150 source files charted' },
      { value: '23', label: 'defects found and fixed, all rounds' },
      { value: '≈13', label: 'estimated still in audited areas' },
      { value: '1', label: 'areas settled' },
    ]);
  });

  it('queues by place, leaving out areas a live run holds', () => {
    expect(nextUpOf(map.areas).map((a) => a.id)).toEqual(['ui.menu', 'core.scene', 'geom']);
    expect(runHolding(map.runs, 'core.ops')?.round).toBe(41);
    expect(runHolding(map.runs, 'ui.badge')).toBeUndefined();
  });

  it('ticks the rounds axis on round steps', () => {
    expect(ticksFor(74)).toEqual([0, 20, 40, 60, 80]);
    expect(ticksFor(0)).toEqual([0]);
  });
});

describe('treemap', () => {
  it('gives each item an area in proportion to its value, inside the box', () => {
    const box = { x: 0, y: 0, width: 600, height: 400 };
    const out = squarify([6, 6, 4, 3, 2, 2, 1].map((value, i) => ({ item: i, value })), box);
    const total = 24;
    for (const r of out) {
      expect(r.width * r.height).toBeCloseTo((box.width * box.height * [6, 6, 4, 3, 2, 2, 1][r.item]!) / total, 6);
      expect(r.x).toBeGreaterThanOrEqual(-1e-9);
      expect(r.x + r.width).toBeLessThanOrEqual(box.width + 1e-9);
      expect(r.y + r.height).toBeLessThanOrEqual(box.height + 1e-9);
    }
    expect(squarify([{ item: 'a', value: 0 }], box)).toEqual([{ item: 'a', x: 0, y: 0, width: 0, height: 0 }]);
  });

  it('frames each package and puts every area inside its frame', () => {
    const { frames, cells } = layoutMap(map.areas, 800, 400);
    expect(frames.map((f) => [f.name, f.files])).toEqual([['core', 76], ['ui', 48], ['geom', 26]]);
    for (const c of cells) {
      const group = map.areas.find((a) => a.id === c.id)!.group;
      const f = inset(frames.find((fr) => fr.name === group)!, 0);
      expect(c.x).toBeGreaterThanOrEqual(f.x);
      expect(c.y).toBeGreaterThanOrEqual(f.y);
      expect(c.x + c.width).toBeLessThanOrEqual(f.x + f.width);
      expect(c.y + c.height).toBeLessThanOrEqual(f.y + f.height);
    }
    expect(cells).toHaveLength(map.areas.length);
  });
});
