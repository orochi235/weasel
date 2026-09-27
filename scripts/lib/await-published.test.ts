import { describe, expect, it } from 'vitest';
// @ts-expect-error — plain .mjs with no typings; `scripts/` is outside tsconfig's include.
import { awaitPublished } from './await-published.mjs';

type Pkg = { name: string; version: string };

/**
 * A registry where each package goes live at a given time on a fake clock, and
 * a sleep that only advances that clock.
 */
function fakeRegistry(liveAt: Record<string, number>) {
  let clock = 0;
  const asked: string[] = [];
  const sleeps: number[] = [];
  const lines: string[] = [];
  return {
    asked,
    sleeps,
    lines,
    opts: {
      lookup: async ({ name }: Pkg) => {
        asked.push(name);
        return name in liveAt && clock >= liveAt[name];
      },
      sleep: async (ms: number) => {
        sleeps.push(ms);
        clock += ms;
      },
      now: () => clock,
      log: (line: string) => lines.push(line),
    },
  };
}

const pkgs = (...names: string[]): Pkg[] => names.map((name) => ({ name, version: '1.6.1' }));

describe('awaitPublished', () => {
  it('checks every package once and does not wait when all are live', async () => {
    const reg = fakeRegistry({ a: 0, b: 0 });
    const { missing } = await awaitPublished(pkgs('a', 'b'), { ...reg.opts, budgetMs: 900_000 });
    expect(missing).toEqual([]);
    expect(reg.asked).toEqual(['a', 'b']);
    expect(reg.sleeps).toEqual([]);
  });

  // 1.6.1's hud was listed 14 minutes after its upload.
  it('keeps polling a staged package until it lists, asking only for what is missing', async () => {
    const reg = fakeRegistry({ a: 0, hud: 14 * 60_000 });
    const { missing } = await awaitPublished(pkgs('a', 'hud'), { ...reg.opts, budgetMs: 15 * 60_000 });
    expect(missing).toEqual([]);
    expect(reg.asked.filter((n) => n === 'a')).toHaveLength(1);
    expect(reg.asked.filter((n) => n === 'hud').length).toBeGreaterThan(2);
  });

  it('backs off between attempts', async () => {
    const reg = fakeRegistry({});
    await awaitPublished(pkgs('hud'), { ...reg.opts, budgetMs: 15 * 60_000 });
    const [first, second, third] = reg.sleeps;
    expect(second).toBeGreaterThan(first);
    expect(third).toBeGreaterThan(second);
  });

  it('gives up once the budget is spent, without sleeping past it', async () => {
    const reg = fakeRegistry({});
    const { missing } = await awaitPublished(pkgs('a', 'hud'), { ...reg.opts, budgetMs: 15 * 60_000 });
    expect(missing).toEqual(pkgs('a', 'hud'));
    expect(reg.sleeps.reduce((s, ms) => s + ms, 0)).toBe(15 * 60_000);
  });

  it('with no budget, checks once and returns what is missing', async () => {
    const reg = fakeRegistry({ a: 0 });
    const { missing } = await awaitPublished(pkgs('a', 'hud'), { ...reg.opts, budgetMs: 0 });
    expect(missing).toEqual(pkgs('hud'));
    expect(reg.sleeps).toEqual([]);
    expect(reg.asked).toEqual(['a', 'hud']);
  });

  // A run that polls for 15 minutes in silence looks hung.
  it('logs one line per package per attempt', async () => {
    const reg = fakeRegistry({ a: 0, hud: 60_000 });
    await awaitPublished(pkgs('a', 'hud'), { ...reg.opts, budgetMs: 15 * 60_000 });
    const hudLines = reg.lines.filter((l) => l.includes('hud@1.6.1'));
    const hudAsks = reg.asked.filter((n) => n === 'hud').length;
    expect(hudLines).toHaveLength(hudAsks);
    expect(hudLines.at(-1)).toMatch(/ok/);
    expect(hudLines[0]).toMatch(/MISSING/);
    expect(reg.lines.filter((l) => l.includes('a@1.6.1'))).toHaveLength(1);
  });
});
