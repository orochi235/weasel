import { describe, expect, it } from 'vitest';
import { CLOCK_AHEAD_MINUTES, TYPICAL_MINUTES, isFinished, laneStepsOf, laneViewOf, passDone, phaseColor, phaseOf, phasesOf, runClockOf, withLivePasses } from './phases';
import fixture from './fixture.map.json';
import type { AuditLane, AuditRun, LaneStep, LaneStepName, SkulkMap } from './skulkMap.types';

const map = fixture as unknown as SkulkMap;
const MIN = 60_000;
const START = Date.parse('2026-11-19T21:00:00.000Z');
const NOW = Date.parse('2026-11-19T21:30:00.000Z');
const at = (minutes: number) => new Date(START + minutes * MIN).toISOString();
const W: LaneStep = { state: 'waiting' };

const lane = (steps: Partial<Record<LaneStepName, LaneStep>>): AuditLane =>
  ({ id: 'x', steps: { A: W, B: W, match: W, fix: W, patch: W, ...steps } });
const done = (more: Partial<LaneStep> = {}): LaneStep => ({ state: 'done', ...more });
const running = (since: string): LaneStep => ({ state: 'running', node: 'studio', since });
const matched = (a: number, b: number, shared: number) => done({ a, b, shared });

describe('phaseOf', () => {
  it('is review while either reviewer runs or waits, the reviewers sharing one phase', () => {
    expect(phaseOf(lane({}))).toBe('review');
    expect(phaseOf(lane({ A: done(), B: running(at(29)) }))).toBe('reviewed');
    expect(phaseOf(lane({ A: running(at(29)) }))).toBe('review');
  });

  it('is the step running, or the next to run', () => {
    const found = { A: done({ findings: 2 }), B: done({ findings: 1 }) };
    expect(phaseOf(lane(found))).toBe('match');
    expect(phaseOf(lane({ ...found, match: matched(2, 1, 1), fix: running(at(10)) }))).toBe('fix');
    expect(phaseOf(lane({ ...found, match: matched(2, 1, 1), fix: done({ commits: 2 }) }))).toBe('patch');
  });

  it('is conflict once a step fails, and done once patched or matched with nothing found', () => {
    const through = { A: done({ findings: 2 }), B: done({ findings: 1 }), match: matched(2, 1, 1), fix: done({ commits: 2 }) };
    expect(phaseOf(lane({ ...through, patch: { state: 'failed', why: 'conflicts' } }))).toBe('conflict');
    expect(phaseOf(lane({ ...through, patch: done() }))).toBe('done');
    expect(phaseOf(lane({ A: done({ findings: 1 }), B: done(), match: matched(1, 0, 1) }))).toBe('done');
    expect(isFinished(lane({ A: done({ findings: 1 }), B: done(), match: matched(1, 0, 0) }))).toBe(false);
    expect(isFinished(lane({ A: done({ findings: 0 }), B: done({ findings: 0 }) }))).toBe(true);
    expect(isFinished(lane({ A: done(), B: done(), match: matched(2, 1, 1), fix: done({ commits: 0 }) }))).toBe(true);
  });

  it('maps every area a live run holds, and none from a finished run', () => {
    expect([...phasesOf(map.runs)]).toEqual([['core.ops', 'fix'], ['core.debug', 'reviewed']]);
  });
});

describe('laneViewOf', () => {
  it('places each part at its real start for its real minutes, a running one up to now, and one not begun after it', () => {
    const view = laneViewOf(lane({
      A: done({ minutes: 3, findings: 5, started: at(2), ended: at(5) }), B: done({ minutes: 4, findings: 2, started: at(2), ended: at(6) }),
      match: matched(5, 2, 2), fix: running(at(18)),
    }), NOW, START);
    expect(view.phase).toBe('fix');
    expect(view.spans.map((s) => [s.id, ((s.start ?? 0) - START) / MIN, s.ms / MIN, s.state])).toEqual([
      ['review', 2, 4, 'done'], ['match', 6, TYPICAL_MINUTES.match, 'done'], ['fix', 18, 12, 'active'], ['patch', 30, TYPICAL_MINUTES.patch, 'pending'],
    ]);
    expect(view.elapsed).toBe('12 min');
    expect(view.spans.map((s) => s.label)).toEqual(['5+2 found · 4.0 min', '5 total, 2 shared', 'studio · 12 min', '5 found']);
    expect(view.spans[2]!.color).toBe(phaseColor('fix'));
    expect(view.spans[0]!.color).toBe(phaseColor('reviewed'));
  });

  it("starts a lane with no record of when it ran at the round's start, and a part not begun no earlier than now", () => {
    const view = laneViewOf(lane({ A: done({ minutes: 3, findings: 1 }), B: done({ minutes: 5 }) }), NOW, START);
    expect(view.spans.map((s) => ((s.start ?? 0) - START) / MIN)).toEqual([0, 30, 30 + TYPICAL_MINUTES.match, 30 + TYPICAL_MINUTES.match + TYPICAL_MINUTES.fix]);
    expect(view.spans.map((s) => s.fill)).toEqual([undefined, 0, 0, 0]);
  });

  it('captions and shades the patch with the fixer\'s tally of what it fixed', () => {
    const fixed = { A: done({ findings: 3 }), B: done({ findings: 2 }), match: matched(3, 2, 1), fix: done({ minutes: 9, commits: 6, fixed: 3, of: 4, extra: 1 }) };
    expect(laneViewOf(lane(fixed), NOW, START).spans.at(-1)?.label).toBe('3 of 4 fixed +1 extra');
    expect(laneStepsOf(lane({ ...fixed, patch: done({ commits: 6 }) }), NOW).at(-1)?.label).toBe('3 of 4 fixed +1 extra');
    expect(laneViewOf(lane({ ...fixed, fix: done({ minutes: 9, commits: 6 }) }), NOW, START).spans.at(-1)?.label).toBe('4 found');
    expect(laneViewOf(lane(fixed), NOW, START).spans.at(-1)?.fill).toBe(0.75);
    expect(laneStepsOf(lane(fixed), NOW).at(-1)?.fill).toBe(0.75);
  });

  it('counts an area\'s pass done once its fixer is, and gives the map that pass, provisionally', () => {
    const pass = { round: 47, date: '2026-11-20', a: 3, b: 2, shared: 1, distinct: 4, est: 5, left: 1 };
    const fixing = { ...lane({ match: matched(3, 2, 1), fix: { state: 'running' } }), pass };
    const fixed = { ...lane({ match: matched(3, 2, 1), fix: done({ commits: 4 }) }), pass };
    expect([passDone(fixing), passDone(fixed)]).toEqual([false, true]);
    const area = { id: 'x', group: 'x', files: 3, status: 'tonight', queue: null, passes: [], stage: null } as const;
    const run = (l: typeof fixed) => ({ ...map.runs[0]!, running: true, lanes: [l] });
    expect(withLivePasses([area], [run(fixing)])[0]!.passes).toEqual([]);
    expect(withLivePasses([area], [run(fixed)])[0]!.passes).toEqual([{ ...pass, provisional: true }]);
    expect(phasesOf([run(fixed)]).get('x')).toBe('done');
  });

  it('colors a failed part as a conflict and says why', () => {
    const view = laneViewOf(lane({ A: done({ findings: 1 }), B: done({ findings: 1 }), match: matched(1, 1, 1), fix: done({ minutes: 9, commits: 2 }), patch: { state: 'failed', why: 'conflicts' } }), NOW, START);
    expect(view.phase).toBe('conflict');
    expect(view.spans.at(-1)).toMatchObject({ label: 'conflicts', state: 'failed', color: phaseColor('conflict') });
    expect(view.elapsed).toBeNull();
  });
});

describe('runClockOf', () => {
  it('runs a live round from its start to now and room ahead, and a finished one to its end', () => {
    const live = { ...map.runs[0]!, started: at(0) } as AuditRun;
    expect(runClockOf(live, NOW)).toEqual({ from: START, to: NOW + CLOCK_AHEAD_MINUTES * MIN });
    const over = { ...live, running: false, ended: at(40) } as AuditRun;
    expect(runClockOf(over, NOW)).toEqual({ from: START, to: START + 40 * MIN });
  });
});

describe('laneStepsOf', () => {
  it('gives every step one equal column, filled by its state, a running one by its share of the typical time', () => {
    const spans = laneStepsOf(lane({ A: done({ findings: 5, minutes: 3 }), B: running(at(27.5)), match: W }), NOW);
    expect(spans.map((s) => [s.id, s.ms, s.fill])).toEqual([['A', 1, 1], ['B', 1, 0.5], ['match', 1, 0], ['fix', 1, 0], ['patch', 1, 0]]);
    expect(spans.map((s) => s.color)).toEqual(['review', 'reviewed', 'match', 'fix', 'patch'].map((p) => phaseColor(p as never)));
    expect(spans[1]!.label).toBe('studio · 2.5 min');
    expect(spans[2]!.label).toBe('');
  });

  it('stops a running step short of full until it finishes', () => {
    expect(laneStepsOf(lane({ A: running(at(0)) }), NOW)[0]!.fill).toBe(0.9);
  });
});
