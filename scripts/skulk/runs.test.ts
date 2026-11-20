import { spawn, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  areasHeld, claimRound, claimedRounds, clearStatus, lastFinished, lastStartedAt, liveRuns, pruneRuns, requestStop, runDir,
  stopRequested, writeStatus, writeSummary,
} from './runs.mjs';

const RUNS = join(import.meta.dirname, 'runs.mjs');
const dirs: string[] = [];
afterEach(() => {
  for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true });
});
const state = () => {
  const dir = mkdtempSync(join(tmpdir(), 'skulk-runs-'));
  dirs.push(dir);
  return dir;
};
const deadPid = () => spawnSync(process.execPath, ['-e', '']).pid as number;

/** Claims a round from `from` in a process of its own, and answers the round it got. */
const claimElsewhere = (dir: string, from: number) =>
  new Promise<number>((resolve, reject) => {
    const code = `import(${JSON.stringify(RUNS)}).then((m) => console.log(m.claimRound(${from}, process.argv[1])))`;
    const child = spawn(process.execPath, ['-e', code, dir], { stdio: ['ignore', 'pipe', 'inherit'] });
    let out = '';
    child.stdout.on('data', (d) => (out += d));
    child.on('close', (status) => (status === 0 ? resolve(Number(out)) : reject(new Error(`exit ${status}`))));
  });

describe('claimRound', () => {
  it('gives each of several processes starting at once a round of its own', async () => {
    const dir = state();
    const got = await Promise.all(Array.from({ length: 6 }, () => claimElsewhere(dir, 42)));
    expect([...got].sort((a, b) => a - b)).toEqual([42, 43, 44, 45, 46, 47]);
    expect(claimedRounds(dir).sort()).toEqual(['42', '43', '44', '45', '46', '47']);
  });

  it('skips a round already claimed', () => {
    const dir = state();
    expect(claimRound(5, dir)).toBe(5);
    expect(claimRound(5, dir)).toBe(6);
    expect(existsSync(runDir(6, dir))).toBe(true);
  });
});

describe('live runs', () => {
  it('are the runs whose pid is alive, and what they hold is the union of their areas', () => {
    const dir = state();
    for (const round of [41, 42, 43]) claimRound(round, dir);
    writeStatus(41, { step: 'review', areas: ['core.canvas', 'apps.chart'] }, dir);
    writeStatus(42, { step: 'fleet', areas: ['ui.menu'] }, dir);
    writeFileSync(join(runDir(43, dir), 'status.json'), JSON.stringify({ pid: deadPid(), areas: ['gone'] }));
    expect(liveRuns(dir).map((r) => [r.round, r.step])).toEqual([[41, 'review'], [42, 'fleet']]);
    expect([...areasHeld(dir)].sort()).toEqual(['apps.chart', 'core.canvas', 'ui.menu']);
    clearStatus(41, dir);
    expect([...areasHeld(dir)]).toEqual(['ui.menu']);
  });

  it('stop one run without touching another', () => {
    const dir = state();
    claimRound(1, dir);
    claimRound(2, dir);
    requestStop(2, dir);
    expect([stopRequested(1, dir), stopRequested(2, dir)]).toEqual([false, true]);
  });
});

describe('finished runs', () => {
  it('the last finished is the one that ended last, and the last started counts live runs too', () => {
    const dir = state();
    for (const round of [1, 2, 3]) claimRound(round, dir);
    writeSummary(1, { round: 1, started: '2026-11-17T23:00:00Z', ended: '2026-11-18T06:00:00Z' }, dir);
    writeSummary(2, { round: 2, started: '2026-11-18T23:00:00Z', ended: '2026-11-19T02:00:00Z' }, dir);
    expect(lastFinished(dir)?.round).toBe(2);
    writeStatus(3, { started: '2026-11-19T12:00:00Z' }, dir);
    expect(lastStartedAt(dir)?.toISOString()).toBe('2026-11-19T12:00:00.000Z');
    expect(lastFinished(state())).toBeUndefined();
  });

  it('counts a run that left the live list without a summary, so a service restart does not start another night', () => {
    const dir = state();
    claimRound(4, dir);
    writeFileSync(join(runDir(4, dir), 'status.json'), JSON.stringify({ round: 4, started: '2026-11-20T04:12:00Z', pid: 999999 }));
    expect(liveRuns(dir)).toEqual([]);
    expect(lastStartedAt(dir)?.toISOString()).toBe('2026-11-20T04:12:00.000Z');
  });

  it('pruning keeps the newest and every live run', () => {
    const dir = state();
    for (const round of [1, 2, 3, 4, 5]) claimRound(round, dir);
    writeStatus(1, { areas: [] }, dir);
    mkdirSync(join(runDir(2, dir), 'x'));
    pruneRuns(2, dir);
    expect(claimedRounds(dir).sort()).toEqual(['1', '4', '5']);
  });
});
