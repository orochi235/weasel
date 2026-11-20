import { describe, expect, it } from 'vitest';
import { inWindow, nodesAt } from './config.mjs';
import { handle, msUntil, shouldAutoStart, startArgs } from './serviceCore.mjs';

const at = (hhmm: string, day = 16) => {
  const [h, m] = hhmm.split(':').map(Number);
  return new Date(2026, 10, day, h, m);
};

/** A service's live side with `live` rounds running; each start and stop is recorded in `calls`. */
const deps = (live: number[] = []) => {
  const calls: (string | number)[][] = [];
  return {
    calls,
    build: 'abc',
    live: () => live,
    status: () => ({ running: live.length > 0, runs: live.map((round) => ({ round })) }),
    plan: async () => ['round 31'],
    start: (args: string[]) => (calls.push(args), args),
    stop: (rounds: number[]) => calls.push(['stop', ...rounds]),
  };
};

describe('handle', () => {
  it('echoes the id on every reply', async () => {
    const d = deps();
    expect(await handle('{"id":7,"ping":true}', d)).toEqual({ id: 7, pong: true, build: 'abc' });
    expect(await handle('{"id":8,"plan":true}', d)).toEqual({ id: 8, plan: ['round 31'] });
    expect(await handle('{"id":9}', d)).toMatchObject({ id: 9, error: expect.any(String) });
    expect(await handle('nope', d)).toEqual({ error: 'not a JSON object' });
  });

  it('starts a run with the request\'s limits, and another beside it while one runs', async () => {
    const d = deps();
    const reply = await handle(JSON.stringify({ id: 1, start: true, areas: 1, nodes: ['studio'], capUsd: 40, budget: { fix: 5 }, merge: false, sweep: true }), d);
    expect(reply).toMatchObject({ id: 1, started: true });
    expect(d.calls).toEqual([['--areas', '1', '--nodes', 'studio', '--cap-usd', '40', '--budget-fix', '5', '--no-merge', '--sweep']]);
    const busy = deps([41]);
    expect(await handle('{"id":2,"start":true,"only":["ui.menu"]}', busy)).toEqual({ id: 2, started: true, args: ['--only', 'ui.menu'] });
    expect(await handle('{"id":3,"start":true,"budget":{"lunch":1}}', d)).toMatchObject({ error: 'budget has no role lunch' });
  });

  it('answers status for every live run', async () => {
    expect(await handle('{"id":4,"status":true}', deps([41, 42]))).toEqual({ id: 4, running: true, runs: [{ round: 41 }, { round: 42 }] });
  });

  it('stops the run a round names, or every live run', async () => {
    expect(await handle('{"id":1,"stop":true}', deps())).toMatchObject({ id: 1, error: 'no run is running' });
    const d = deps([41, 42]);
    expect(await handle('{"id":2,"stop":true,"round":42}', d)).toMatchObject({ id: 2, stopping: [42] });
    expect(await handle('{"id":3,"stop":true,"round":40}', d)).toMatchObject({ id: 3, error: 'round 40 is not running', running: [41, 42] });
    expect(await handle('{"id":4,"stop":true}', d)).toMatchObject({ id: 4, stopping: [41, 42] });
    expect(d.calls).toEqual([['stop', 42], ['stop', 41, 42]]);
  });

  it('rejects start fields it does not know', () => {
    expect(() => startArgs({ start: true, area: 3 })).toThrow('start does not take area');
  });
});

describe('the automatic start', () => {
  it('waits for the next start time, tomorrow once today\'s has passed', () => {
    expect(msUntil(at('22:00'), '23:00')).toBe(3_600_000);
    expect(msUntil(at('23:00'), '23:00')).toBe(24 * 3_600_000);
  });

  it('starts after the start time when no night started since it and nothing is running', () => {
    expect(shouldAutoStart({ now: at('23:05'), running: false, lastStarted: undefined, startAt: '23:00' })).toBe(true);
    expect(shouldAutoStart({ now: at('22:59'), running: false, lastStarted: undefined, startAt: '23:00' })).toBe(false);
    expect(shouldAutoStart({ now: at('23:05'), running: true, lastStarted: undefined, startAt: '23:00' })).toBe(false);
    expect(shouldAutoStart({ now: at('23:05'), running: false, lastStarted: at('00:30'), startAt: '23:00' })).toBe(true);
    expect(shouldAutoStart({ now: at('23:05'), running: false, lastStarted: at('14:00'), startAt: '23:00' })).toBe(true);
    expect(shouldAutoStart({ now: at('23:05'), running: false, lastStarted: at('23:01'), startAt: '23:00' })).toBe(false);
    expect(shouldAutoStart({ now: at('23:05'), running: false, lastStarted: at('23:30', 15), startAt: '23:00' })).toBe(true);
  });
});

describe('nodesAt', () => {
  it('adds this Mac only inside its window', () => {
    expect(nodesAt(at('23:59'))).not.toContain('orochi');
    expect(nodesAt(at('00:00'))).toContain('orochi');
    expect(nodesAt(at('08:59'))).toContain('orochi');
    expect(nodesAt(at('09:00'))).not.toContain('orochi');
    expect(inWindow(at('23:30'), '23:00', '02:00')).toBe(true);
    expect(inWindow(at('03:00'), '23:00', '02:00')).toBe(false);
  });
});
