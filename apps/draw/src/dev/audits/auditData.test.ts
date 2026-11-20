import { describe, expect, it } from 'vitest';
import { heatScaleOf, labelIn, nextUpOf, runHolding, statsFor, toneOf, wrapAtDots } from './areaData';
import { headlineOf, parseJob, recentJobsOf, spendOf, stepText } from './runData';
import { inSharedSteps, sharedSpansOf } from './phases';
import { ticksFor } from './RoundsChart';
import { layoutMap, squarify } from './mapLayout';
import { areaTree, leavesOf, type AreaTreeNode } from './areaTree';
import fixture from './fixture.map.json';
import type { SkulkMap } from './skulkMap.types';

const map = fixture as unknown as SkulkMap;
const [live, finished] = map.runs as [SkulkMap['runs'][0], SkulkMap['runs'][0]];
const now = Date.parse(map.generated);

describe('lanes', () => {
  it('says what each step of an area has done, or how long it has been running', () => {
    const ops = live.lanes[0]!;
    expect(stepText('A', ops.steps.A, now)).toBe('5 found · 2.8 min');
    expect(stepText('match', ops.steps.match, now)).toBe('5 total, 2 shared');
    expect(stepText('fix', ops.steps.fix, now)).toBe('studio · 12 min');
    expect(stepText('patch', ops.steps.patch, now)).toBe('after fix');
    expect(stepText('B', live.lanes[1]!.steps.B, now)).toBe('studio · <1 min');
    expect(stepText('fix', { state: 'done', commits: 1, minutes: 7.6 }, now)).toBe('1 commit · 7.6 min');
    expect(stepText('patch', { state: 'failed', why: 'conflicts; left out of the batch' }, now)).toBe('conflicts; left out of the batch');
  });

  it('runs the shared lane through batch, fleet run and merge, the fleet run filled by the tests it has run', () => {
    const states = (run: typeof live) => sharedSpansOf(run).map((s) => [s.id, s.state, s.fill]);
    expect(inSharedSteps(live)).toBe(false);
    expect(states({ ...live, step: 'batch' })).toEqual([['batch', 'active', 0], ['fleet', 'pending', 0], ['merge', 'pending', 0]]);
    const running = { ...live, step: 'fleet', fleet: { tests: { done: 250, total: 1000 }, build: { done: 30, total: 40 } } };
    const fleet = sharedSpansOf(running, 'tests');
    expect(fleet.map((s) => [s.id, s.state, s.fill])).toEqual([['batch', 'done', 1], ['fleet', 'active', 0.25], ['merge', 'pending', 0]]);
    expect(fleet[1]!.label).toBe('fleet tests · 25%');
    expect(sharedSpansOf(running, 'build')[1]!.label).toBe('postbuild · 75%');
    expect(states({ ...live, step: 'merge-wait' })).toEqual([['batch', 'done', 1], ['fleet', 'done', 1], ['merge', 'active', 0]]);
    expect(states(finished).every(([, state]) => state === 'done')).toBe(true);
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
    expect(parseJob('fix 2/4 core.ops on studio: 3 commits, 12.0 min, 0.81M weighted tokens')).toMatchObject({ kind: 'fix', tokens: 0.81 });
    expect(parseJob('match 1/4 core.ops: 2 shared of 5 + 4')).toMatchObject({ kind: 'match', what: '7 total, 2 shared' });
    expect(parseJob('batch: audit41-core.ops conflicts; left out')?.bad).toBe(true);
    expect(parseJob('fleet: 2 failed')).toMatchObject({ kind: 'fleet', bad: true });
    expect(parseJob('something else')).toBeNull();
  });

  it('reads a patch that did not apply as a bad patch job', () => {
    expect(parseJob('patch core.ops: did not apply: error: patch failed: a.ts:3')).toEqual({
      kind: 'patch', label: 'patch', area: 'core.ops', what: 'did not apply: error: patch failed: a.ts:3', bad: true,
    });
    expect(parseJob('patch core.ops: 2 commits on audit41-core.ops')).toMatchObject({ kind: 'patch', bad: false });
  });

  it('reads a sweep that came back, and not the plan announcing one', () => {
    expect(parseJob('control sweep: 2 dead, 1 unsure, 0 skipped of 90 controls in 12 demos, 6.5 min')).toMatchObject({
      kind: 'sweep', what: '2 dead, 1 unsure, 0 skipped of 90 controls in 12 demos, 6.5 min', bad: false,
    });
    expect(parseJob('control sweep: did not run (no gui node)')).toMatchObject({ kind: 'sweep', bad: true });
    expect(parseJob('control sweep: off (it runs only with --sweep)')).toBeNull();
    expect(parseJob('control sweep: one browser job at the frozen commit beside the reviews, and a fixer for what it finds dead')).toBeNull();
  });

  it('marks a review that did not finish, and says so and that it hit its ceiling', () => {
    const line = 'review 1/4 core.ops B on teitou: 2 findings, 12/12 files read, 9.0 min, 1.20M tokens';
    expect(parseJob(`${line}, hit its ceiling, unfinished: not counted as a pass`)).toMatchObject({
      what: '2 findings, read 12 of 12 files, hit its ceiling, unfinished: not counted as a pass', bad: true,
    });
    expect(parseJob(`${line}, hit its ceiling`)).toMatchObject({ what: '2 findings, read 12 of 12 files, hit its ceiling', bad: false });
  });

  it('keys two identical lines of one log apart', () => {
    const run = { ...map.runs[0]!, lines: ['fleet: test:batch passed', 'fleet: test:batch passed'] };
    const keys = recentJobsOf([run]).map((j) => j.key);
    expect(new Set(keys).size).toBe(2);
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
    expect(map.areas.map(toneOf)).toEqual([{ left: 1.7 }, 'unaudited', { left: 10 }, 'settled', 'unaudited', { left: 1 }]);
  });

  it('puts defects left on a heat scale whose top is the 98th percentile, at least 8, ticked evenly along it', () => {
    const heat = heatScaleOf(map.areas);
    expect(heat.top).toBeCloseTo(9.668);
    expect(heat.at(0)).toBe(0);
    expect(heat.at(heat.top)).toBe(1);
    expect(heat.at(40)).toBe(1);
    expect(heat.at(1.7)).toBeCloseTo(Math.log1p(1.7) / Math.log1p(9.668));
    const ticks = heat.ticks.map((t) => t.value);
    expect(ticks.slice(0, -1)).toEqual([0, 1, 2, 5]);
    expect(heat.ticks.at(-1)).toMatchObject({ label: 'top', value: expect.closeTo(9.668, 2) });
    const gaps = ticks.slice(1).map((t, i) => heat.at(t) - heat.at(ticks[i]!));
    // Whole-number ticks trade a little evenness: 0, 1, 2, 5 over 0, 0.8, 2.5, 5.
    expect(Math.max(...gaps) / Math.min(...gaps)).toBeLessThan(1.8);
    expect(heatScaleOf([]).top).toBe(8);
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
    expect(ticksFor(1.7)).toEqual([0, 0.5, 1, 1.5, 2]);
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

  it('frames the areas that share a path and puts each one inside its frame', () => {
    const { frames, cells } = layoutMap(map.areas, 800, 400);
    expect(frames.map((f) => [f.name, f.files, f.parent])).toEqual([['core', 76, null], ['ui', 48, null]]);
    expect(cells.find((c) => c.id === 'geom')?.parent).toBeNull();
    for (const c of cells.filter((cell) => cell.parent !== null)) {
      const f = frames.find((fr) => fr.name === c.parent)!;
      expect(c.x).toBeGreaterThanOrEqual(f.x);
      expect(c.y).toBeGreaterThanOrEqual(f.y);
      expect(c.x + c.width).toBeLessThanOrEqual(f.x + f.width);
      expect(c.y + c.height).toBeLessThanOrEqual(f.y + f.height);
    }
    expect(cells).toHaveLength(map.areas.length);
  });

  it('nests a frame inside its parent, a step deeper', () => {
    const areas = ['core.domains', 'core.domains.paths', 'core.domains.snap', 'core.ops', 'geom'].map((id) => ({ id, files: 10 }));
    const { frames, cells } = layoutMap(areas, 800, 400);
    expect(frames.map((f) => [f.name, f.parent, f.depth])).toEqual([['core', null, 0], ['core.domains', 'core', 1]]);
    expect(cells.map((c) => [c.id, c.parent]).sort()).toEqual([
      ['core.domains', 'core.domains'], ['core.domains.paths', 'core.domains'], ['core.domains.snap', 'core.domains'], ['core.ops', 'core'], ['geom', null],
    ]);
  });
});

describe('areaTree', () => {
  const tree = (ids: string[]) => areaTree(ids.map((id) => ({ id, files: 1 })));
  const shape = (nodes: readonly AreaTreeNode[]): unknown[] =>
    nodes.map((n) => (n.kind === 'area' ? n.id : { [n.name]: shape(n.children) }));

  it('makes a frame of every shared prefix, an area that is also a prefix one cell beside its siblings', () => {
    expect(shape(tree(['apps.site', 'apps.draw.src', 'apps.draw.src.dev', 'devtools', 'devtools.page', 'devtools.views']))).toEqual([
      { apps: ['apps.site', { 'apps.draw.src': ['apps.draw.src', 'apps.draw.src.dev'] }] },
      { devtools: ['devtools', 'devtools.page', 'devtools.views'] },
    ]);
  });

  it('collapses a frame with one child into that child, ending at the area itself', () => {
    expect(shape(tree(['apps.draw.src.dev.audits', 'core.interactions.actions.part1', 'core.interactions.actions.part2']))).toEqual([
      'apps.draw.src.dev.audits',
      { 'core.interactions.actions': ['core.interactions.actions.part1', 'core.interactions.actions.part2'] },
    ]);
  });

  it('gives every area exactly one leaf, and no frame holds only one', () => {
    const ids = [...map.areas.map((a) => a.id), 'core.domains', 'core.domains.paths', 'devtools', 'devtools.page', 'cursor'];
    const nodes = tree(ids);
    expect(leavesOf(nodes).sort()).toEqual([...ids].sort());
    const frames = (ns: readonly AreaTreeNode[]): AreaTreeNode[] => ns.flatMap((n) => (n.kind === 'frame' ? [n, ...frames(n.children)] : []));
    for (const f of frames(nodes)) expect(f.kind === 'frame' && f.children.length).toBeGreaterThan(1);
  });
});

describe('labelIn', () => {
  it("shows only what the frame's path does not", () => {
    expect(labelIn('apps.draw.src.dev', 'apps.draw.src')).toBe('dev');
    expect(labelIn('apps.draw.src', 'apps')).toBe('draw.src');
    expect(labelIn('devtools', 'devtools')).toBe('devtools');
    expect(labelIn('apps.draw.src.dev.audits', null)).toBe('apps.draw.src.dev.audits');
  });
});

describe('wrapAtDots', () => {
  it('breaks an id after its dots, as many pieces to a line as fit', () => {
    expect(wrapAtDots('core.domains.paths', 20, 3)).toEqual(['core.domains.paths']);
    expect(wrapAtDots('core.domains.paths', 13, 3)).toEqual(['core.domains.', 'paths']);
    expect(wrapAtDots('core.domains.paths', 8, 3)).toEqual(['core.', 'domains.', 'paths']);
  });

  it('cuts the last line it has room for, and a piece too long for any line', () => {
    expect(wrapAtDots('core.domains.paths', 8, 2)).toEqual(['core.', 'domains…']);
    expect(wrapAtDots('interactions.x', 6, 3)).toEqual(['inter…', 'x']);
    expect(wrapAtDots('core', 0, 3)).toEqual([]);
  });
});
