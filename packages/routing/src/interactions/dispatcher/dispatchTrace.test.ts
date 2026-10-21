import { describe, it, expect, vi } from 'vitest';
import { createDispatchTrace, createTraceRing } from './dispatchTrace';

describe('createTraceRing', () => {
  it('records nothing outside a dev build until something watches it', () => {
    const ring = createTraceRing<number>(10, false);
    ring.push(1);
    expect(ring.since(0).entries).toEqual([]);
    const release = ring.watch();
    ring.push(2);
    release();
    ring.push(3);
    expect(ring.since(0).entries).toEqual([2]);
  });

  it('hands back only what was pushed after the cursor, skipping what it dropped', () => {
    const ring = createTraceRing<number>(3, true);
    for (const n of [1, 2, 3, 4, 5]) ring.push(n);
    const first = ring.since(0);
    expect(first).toEqual({ entries: [3, 4, 5], cursor: 5 });
    ring.push(6);
    expect(ring.since(first.cursor)).toEqual({ entries: [6], cursor: 6 });
  });

  it('notifies on each kept push only, and a second release changes nothing', () => {
    const ring = createTraceRing<number>(3, false);
    const heard = vi.fn();
    ring.subscribe(heard);
    const other = ring.watch();
    const release = ring.watch();
    release();
    release();
    ring.push(1);
    other();
    ring.push(2);
    expect(heard).toHaveBeenCalledTimes(1);
  });
});

describe('createDispatchTrace', () => {
  it('records a mode switch and builds the live record only when read', () => {
    const trace = createDispatchTrace(10, true);
    trace.recordModeSwitch('editAnchors.editingId', null, 'p1', 'enter');
    expect(trace.since(0).entries).toMatchObject([
      { kind: 'mode', mode: 'editAnchors.editingId', to: 'p1', detail: 'enter' },
    ]);
    const explain = vi.fn(() => ({ kind: 'dispatch' }) as never);
    trace.setLive(explain);
    expect(explain).not.toHaveBeenCalled();
    trace.live();
    expect(explain).toHaveBeenCalledTimes(1);
    trace.setLive(null);
    expect(trace.live()).toBeNull();
  });
});
