import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { createSlots } from './jobs.mjs';
import { leaseAt, pidAlive, takeLease, waitForLease } from './lease.mjs';
import { mergeLock } from './runs.mjs';

const dirs: string[] = [];
afterEach(() => {
  for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true });
});
const state = () => {
  const dir = mkdtempSync(join(tmpdir(), 'skulk-lease-'));
  dirs.push(dir);
  return dir;
};
/** The pid of a process that has already exited. */
const deadPid = () => spawnSync(process.execPath, ['-e', '']).pid as number;

describe('takeLease', () => {
  it('holds a path for one taker until it is released', () => {
    const path = join(state(), 'x', 'lease');
    const release = takeLease(path, { round: 42 });
    expect(release).toBeTypeOf('function');
    expect(leaseAt(path)).toMatchObject({ pid: process.pid, round: 42 });
    expect(takeLease(path)).toBeUndefined();
    release!();
    expect(existsSync(path)).toBe(false);
    const again = takeLease(path, { round: 43 });
    expect(leaseAt(path)).toMatchObject({ round: 43 });
    again!();
  });

  it('takes back a lease whose holder has died, and leaves no file aside', () => {
    const dir = state();
    const path = join(dir, 'lease');
    const dead = deadPid();
    expect(pidAlive(dead)).toBe(false);
    writeFileSync(path, JSON.stringify({ pid: dead, round: 40 }));
    const release = takeLease(path, { round: 41 });
    expect(release).toBeTypeOf('function');
    expect(leaseAt(path)).toMatchObject({ pid: process.pid, round: 41 });
    expect(readdirSync(dir)).toEqual(['lease']);
    release!();
  });

  it('does not take a lease a live process holds, nor one it cannot read', () => {
    const path = join(state(), 'lease');
    writeFileSync(path, JSON.stringify({ pid: process.ppid, round: 40 }));
    expect(takeLease(path)).toBeUndefined();
    writeFileSync(path, '{"pid":');
    expect(takeLease(path)).toBeUndefined();
  });

  it('releasing twice, or after another took it, leaves the other\'s lease alone', () => {
    const path = join(state(), 'lease');
    const release = takeLease(path)!;
    release();
    const other = takeLease(path, { round: 2 })!;
    release();
    expect(leaseAt(path)).toMatchObject({ round: 2 });
    other();
  });
});

describe('the merge lock', () => {
  it('lets a second run in only once the first lets go', async () => {
    const path = mergeLock(state());
    const first = takeLease(path, { round: 1 })!;
    const heard: unknown[] = [];
    let second: (() => void) | undefined;
    const waiting = waitForLease(path, { round: 2 }, { pollMs: 5, onWait: (h) => heard.push(h) }).then((r) => (second = r));
    await new Promise((resolve) => setTimeout(resolve, 30));
    expect(second).toBeUndefined();
    expect(heard).toEqual([expect.objectContaining({ round: 1 })]);
    first();
    await waiting;
    expect(leaseAt(path)).toMatchObject({ round: 2 });
    second!();
  });
});

describe('createSlots over leases', () => {
  it('shares one node\'s trees between two runs', () => {
    const dir = state();
    const a = createSlots(['studio'], { about: { round: 1 }, state: dir });
    const b = createSlots(['studio'], { about: { round: 2 }, state: dir });
    const taken = [a.take('review'), b.take('review'), a.take('review'), b.take('review'), a.take('review'), b.take('review')];
    expect(taken.map((s) => s?.tree).sort()).toEqual([1, 2, 3, 4, 5, 6].map((k) => `weasel-skulk-r${k}`));
    expect(a.take('review')).toBeUndefined();
    expect(b.take('review')).toBeUndefined();
    expect([a.inUse(), b.inUse()]).toEqual([3, 3]);
    expect(leaseAt(join(dir, 'slots', 'studio', taken[1]!.tree))).toMatchObject({ round: 2, role: 'review' });
    taken[1]!.release();
    expect(a.take('review')?.tree).toBe(taken[1]!.tree);
    expect(b.inUse()).toBe(2);
  });

  it('keeps a fixer slot per node, and reclaims one a dead run left', () => {
    const dir = state();
    mkdirSync(join(dir, 'slots', 'teitou'), { recursive: true });
    writeFileSync(join(dir, 'slots', 'teitou', 'weasel-skulk-f1'), JSON.stringify({ pid: deadPid(), round: 40 }));
    const a = createSlots(['studio', 'teitou'], { state: dir });
    const b = createSlots(['studio', 'teitou'], { state: dir });
    expect(a.take('fix')?.node).toBe('studio');
    expect(b.take('fix')).toMatchObject({ node: 'teitou', tree: 'weasel-skulk-f1' });
    expect(a.take('fix')).toBeUndefined();
  });
});
