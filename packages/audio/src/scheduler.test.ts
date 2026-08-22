import { describe, expect, it, vi } from 'vitest';
import { createScheduler } from './scheduler';

/**
 * Deterministic clock + timer pair. Every `setTimer` call is recorded, so a
 * test can tell a re-arm from a pass that ran off the previous arm.
 */
function harness(startMs = 0) {
  let nowMs = startMs;
  let nextHandle = 1;
  const arms: { cb: () => void; ms: number; handle: number }[] = [];
  const cleared: unknown[] = [];
  const scheduler = createScheduler({
    now: () => nowMs,
    setTimer: (cb, ms) => {
      const handle = nextHandle++;
      arms.push({ cb, ms, handle });
      return handle;
    },
    clearTimer: (handle) => { cleared.push(handle); },
    lookahead: 100,
    interval: 25,
  });
  const latest = () => arms[arms.length - 1];
  return {
    scheduler,
    advanceTo: (t: number) => { nowMs = t; },
    /** Run the most recently armed pass, as its timer would. */
    tick: () => { latest()?.cb(); },
    armCount: () => arms.length,
    armIntervals: () => arms.map((a) => a.ms),
    isStopped: () => cleared.includes(latest()?.handle),
  };
}

describe('createScheduler', () => {
  it('fires an event already due on the next pass', () => {
    const h = harness();
    const fire = vi.fn();
    h.scheduler.start();
    h.scheduler.schedule(0, fire);
    h.tick();
    expect(fire).toHaveBeenCalledTimes(1);
  });

  it('fires an event inside the lookahead window early, with its true time', () => {
    const h = harness();
    const fire = vi.fn();
    h.scheduler.start();
    h.scheduler.schedule(80, fire);   // now=0, lookahead=100 → due
    h.tick();
    expect(fire).toHaveBeenCalledWith(80);
  });

  it('does not fire an event beyond the lookahead window', () => {
    const h = harness();
    const fire = vi.fn();
    h.scheduler.start();
    h.scheduler.schedule(500, fire);
    h.tick();
    expect(fire).not.toHaveBeenCalled();
  });

  it('fires it on a later pass once the window reaches it', () => {
    const h = harness();
    const fire = vi.fn();
    h.scheduler.start();
    h.scheduler.schedule(500, fire);
    h.tick();
    h.advanceTo(450);
    h.tick();
    expect(fire).toHaveBeenCalledTimes(1);
  });

  it('never fires the same event twice', () => {
    const h = harness();
    const fire = vi.fn();
    h.scheduler.start();
    h.scheduler.schedule(10, fire);
    h.tick();
    h.advanceTo(200);
    h.tick();
    h.tick();
    expect(fire).toHaveBeenCalledTimes(1);
  });

  it('fires due events in time order regardless of scheduling order', () => {
    const h = harness();
    const order: number[] = [];
    h.scheduler.start();
    h.scheduler.schedule(50, () => order.push(50));
    h.scheduler.schedule(10, () => order.push(10));
    h.scheduler.schedule(30, () => order.push(30));
    h.tick();
    expect(order).toEqual([10, 30, 50]);
  });

  it('leaves events beyond the horizon queued', () => {
    const h = harness();
    h.scheduler.start();
    h.scheduler.schedule(10, vi.fn());
    h.scheduler.schedule(500, vi.fn());
    h.tick();
    expect(h.scheduler.pending()).toBe(1);
  });

  it('cancels pending events by key without touching others', () => {
    const h = harness();
    const kept = vi.fn();
    const dropped = vi.fn();
    h.scheduler.start();
    h.scheduler.schedule(10, kept, 'keep');
    h.scheduler.schedule(10, dropped, 'drop');
    h.scheduler.cancelKey('drop');
    h.tick();
    expect(kept).toHaveBeenCalledTimes(1);
    expect(dropped).not.toHaveBeenCalled();
  });

  it('arms the timer once on start(), at the configured interval', () => {
    const h = harness();
    h.scheduler.start();
    expect(h.armIntervals()).toEqual([25]);
  });

  it('ignores a second start()', () => {
    const h = harness();
    h.scheduler.start();
    h.scheduler.start();
    expect(h.armCount()).toBe(1);
  });

  it('re-arms itself after every pass, at the configured interval', () => {
    const h = harness();
    h.scheduler.start();
    h.tick();
    h.tick();
    expect(h.armIntervals()).toEqual([25, 25, 25]);
  });

  it('re-arms even when the pass fired nothing', () => {
    const h = harness();
    h.scheduler.start();
    h.tick();
    expect(h.armCount()).toBe(2);
  });

  it('stops the timer on stop()', () => {
    const h = harness();
    h.scheduler.start();
    h.scheduler.stop();
    expect(h.isStopped()).toBe(true);
  });

  it('does not re-arm when a pass already in flight runs after stop()', () => {
    const h = harness();
    h.scheduler.start();
    h.scheduler.stop();
    h.tick();
    expect(h.armCount()).toBe(1);
  });

  it('arms again on a start() after a stop()', () => {
    const h = harness();
    h.scheduler.start();
    h.scheduler.stop();
    h.scheduler.start();
    expect(h.armCount()).toBe(2);
  });

  it('counts queued events as pending', () => {
    const h = harness();
    h.scheduler.start();
    expect(h.scheduler.pending()).toBe(0);
    h.scheduler.schedule(500, vi.fn());
    h.scheduler.schedule(600, vi.fn());
    expect(h.scheduler.pending()).toBe(2);
  });

  it('drops fired events from the pending count', () => {
    const h = harness();
    h.scheduler.start();
    h.scheduler.schedule(10, vi.fn());
    h.tick();
    expect(h.scheduler.pending()).toBe(0);
  });

  it('drops cancelled events from the pending count', () => {
    const h = harness();
    h.scheduler.schedule(500, vi.fn(), 'k');
    h.scheduler.cancelKey('k');
    expect(h.scheduler.pending()).toBe(0);
  });

  it('keeps running when one callback throws', () => {
    const h = harness();
    const after = vi.fn();
    vi.spyOn(console, 'error').mockImplementation(() => {});
    h.scheduler.start();
    h.scheduler.schedule(10, () => { throw new Error('boom'); });
    h.scheduler.schedule(20, after);
    h.tick();
    expect(after).toHaveBeenCalledTimes(1);
  });

  it('re-arms even when a callback throws', () => {
    const h = harness();
    vi.spyOn(console, 'error').mockImplementation(() => {});
    h.scheduler.start();
    h.scheduler.schedule(10, () => { throw new Error('boom'); });
    h.tick();
    expect(h.armCount()).toBe(2);
  });
});
