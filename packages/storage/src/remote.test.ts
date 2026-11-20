import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { RecordChange } from './records';
import { createRemote, type RemoteOptions } from './remote';

/** A remote over `values` whose record `x` is contested: another writer set it while a write of ours was on its way. */
function contestedRemote(values: Map<string, unknown>, read: RemoteOptions['read']) {
  let owned = true;
  const applied: RecordChange[][] = [];
  const remote = createRemote({
    prefix: 'p:',
    values,
    owns: () => owned,
    queued: () => false,
    live: () => true,
    read,
    retryMs: 1000,
    retryMaxMs: 30_000,
    applied: (c) => applied.push(c),
    overruled: () => {},
  });
  remote.apply([['p:x', 'B']]);
  owned = false;
  return { remote, applied };
}

describe('reconciling a contested record', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('drops a read that began before a heard delete of a record the cache no longer holds', async () => {
    let finish: (v: unknown) => void = () => {};
    const values = new Map<string, unknown>();
    const { remote } = contestedRemote(values, () => new Promise((r) => (finish = r)));
    remote.settled('x');
    remote.apply([['p:x', undefined]]);
    finish('B');
    await vi.advanceTimersByTimeAsync(0);
    expect(values.has('x')).toBe(false);
  });

  it('reads again on a backoff when the read fails', async () => {
    const read = vi.fn().mockRejectedValueOnce(new Error('closed')).mockResolvedValue('B');
    const values = new Map<string, unknown>([['x', 'A']]);
    const { remote } = contestedRemote(values, read);
    remote.settled('x');
    await vi.advanceTimersByTimeAsync(0);
    expect(values.get('x')).toBe('A');
    await vi.advanceTimersByTimeAsync(1000);
    expect(read).toHaveBeenCalledTimes(2);
    expect(values.get('x')).toBe('B');
  });

  it('reports no change when storage reads back a copy of a Map, Set, Date or typed array the cache holds', async () => {
    const held = {
      m: new Map<unknown, unknown>([[{ k: 1 }, new Set([1, 2])]]),
      d: new Date(5),
      b: new Uint8Array([1, 2, 3]),
    };
    const values = new Map<string, unknown>([['x', held]]);
    const { remote, applied } = contestedRemote(values, async () => structuredClone(held));
    remote.settled('x');
    await vi.advanceTimersByTimeAsync(0);
    expect(applied).toEqual([]);
    expect(values.get('x')).toBe(held);
  });

  it('takes a read-back Map whose entries differ', async () => {
    const values = new Map<string, unknown>([['x', new Map([['a', 1]])]]);
    const { remote, applied } = contestedRemote(values, async () => new Map([['a', 2]]));
    remote.settled('x');
    await vi.advanceTimersByTimeAsync(0);
    expect(applied).toHaveLength(1);
  });
});
