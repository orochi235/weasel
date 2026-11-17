import { describe, expect, it } from 'vitest';
import { inWindow, nodesAt } from './config.mjs';
import { handle, msUntil, shouldAutoStart, startArgs } from './serviceCore.mjs';

const at = (hhmm: string, day = 16) => {
  const [h, m] = hhmm.split(':').map(Number);
  return new Date(2026, 10, day, h, m);
};

const deps = (running = false) => {
  const calls: string[][] = [];
  return {
    calls,
    build: 'abc',
    running: () => running,
    status: () => ({ running }),
    plan: async () => ['round 31'],
    start: (args: string[]) => (calls.push(args), args),
    stop: () => calls.push(['stop']),
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

  it('starts a night with the request\'s limits, and refuses a second while one runs', async () => {
    const d = deps();
    const reply = await handle(JSON.stringify({ id: 1, start: true, areas: 1, nodes: ['studio'], capUsd: 40, budget: { fix: 5 }, merge: false }), d);
    expect(reply).toMatchObject({ id: 1, started: true });
    expect(d.calls).toEqual([['--areas', '1', '--nodes', 'studio', '--cap-usd', '40', '--budget-fix', '5', '--no-merge']]);
    expect(await handle('{"id":2,"start":true}', deps(true))).toMatchObject({ id: 2, error: 'a night is already running' });
    expect(await handle('{"id":3,"start":true,"budget":{"lunch":1}}', d)).toMatchObject({ error: 'budget has no role lunch' });
  });

  it('stops only a running night', async () => {
    expect(await handle('{"id":1,"stop":true}', deps())).toMatchObject({ error: 'no night is running' });
    const d = deps(true);
    expect(await handle('{"id":2,"stop":true}', d)).toMatchObject({ id: 2, stopping: true });
    expect(d.calls).toEqual([['stop']]);
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

  it('starts after the start time when nothing ran today and nothing is running', () => {
    expect(shouldAutoStart({ now: at('23:05'), running: false, lastStarted: undefined, startAt: '23:00' })).toBe(true);
    expect(shouldAutoStart({ now: at('22:59'), running: false, lastStarted: undefined, startAt: '23:00' })).toBe(false);
    expect(shouldAutoStart({ now: at('23:05'), running: true, lastStarted: undefined, startAt: '23:00' })).toBe(false);
    expect(shouldAutoStart({ now: at('23:05'), running: false, lastStarted: at('14:00'), startAt: '23:00' })).toBe(false);
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
