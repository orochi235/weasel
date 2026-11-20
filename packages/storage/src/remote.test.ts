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
});
