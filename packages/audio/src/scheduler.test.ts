import { describe, expect, it, vi } from 'vitest';
import { createScheduler } from './scheduler';

/** Deterministic clock + timer pair. `tick()` runs one scheduler pass. */
function harness(startMs = 0) {
  let nowMs = startMs;
  let pass: (() => void) | null = null;
  const scheduler = createScheduler({
    now: () => nowMs,
    setTimer: (cb) => { pass = cb; return 1; },
    clearTimer: () => { pass = null; },
    lookahead: 100,
    interval: 25,
  });
  return {
    scheduler,
    advanceTo: (t: number) => { nowMs = t; },
    tick: () => pass?.(),
    isStopped: () => pass === null,
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

  it('stops the timer on stop()', () => {
    const h = harness();
    h.scheduler.start();
    h.scheduler.stop();
    expect(h.isStopped()).toBe(true);
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
});
