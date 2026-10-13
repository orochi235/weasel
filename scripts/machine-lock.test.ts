import { mkdirSync, mkdtempSync, rmSync, utimesSync, writeFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { holdMachineLock } from './machine-lock.ts';

let root: string;
let lock: string;

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'machine-lock-test-'));
  lock = join(root, 'the.lock');
});
afterEach(() => { rmSync(root, { recursive: true, force: true }); });

const FAST = { pollMs: 2 };
const tick = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

describe('holdMachineLock', () => {
  it('makes a second holder wait until the first lets go', async () => {
    const log: string[] = [];
    const release = await holdMachineLock(lock, FAST);
    const second = holdMachineLock(lock, FAST).then((r) => { log.push('second in'); return r; });
    await tick(20);
    log.push('first out');
    release();
    (await second)();
    expect(log).toEqual(['first out', 'second in']);
  });

  it('leaves nothing on disk once released', async () => {
    (await holdMachineLock(lock, FAST))();
    expect(existsSync(lock)).toBe(false);
  });

  it('takes over a lock whose holder is no longer running', async () => {
    mkdirSync(lock);
    // No process has pid 0 to signal; a kill(0, 0) reaches the caller's own group, so use an id past any real one.
    writeFileSync(join(lock, 'pid'), '2147483646');
    const release = await holdMachineLock(lock, FAST);
    release();
    expect(existsSync(lock)).toBe(false);
  });

  it('takes over a lock held longer than the stale time, though its holder still runs', async () => {
    mkdirSync(lock);
    writeFileSync(join(lock, 'pid'), String(process.pid));
    const longAgo = new Date(Date.now() - 60_000);
    utimesSync(lock, longAgo, longAgo);
    const release = await holdMachineLock(lock, { ...FAST, staleMs: 1000 });
    release();
    expect(existsSync(lock)).toBe(false);
  });

  it('does not let go of a lock someone else took over', async () => {
    const release = await holdMachineLock(lock, FAST);
    rmSync(lock, { recursive: true });
    const other = await holdMachineLock(lock, FAST);
    release();
    expect(existsSync(lock)).toBe(true);
    other();
  });
});
