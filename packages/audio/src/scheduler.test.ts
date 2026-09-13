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

  it('empties the queue on clear() without stopping the timer', () => {
    const h = harness();
    const fire = vi.fn();
    h.scheduler.start();
    h.scheduler.schedule(500, fire);
    h.scheduler.clear();
    expect(h.scheduler.pending()).toBe(0);
    h.advanceTo(500);
    h.tick();
    expect(fire).not.toHaveBeenCalled();
    expect(h.armCount()).toBe(2);
  });

  it('does not replay events missed while stopped, once cleared', () => {
    const h = harness();
    const fire = vi.fn();
    h.scheduler.start();
    h.scheduler.schedule(100, fire);
    h.scheduler.stop();
    h.advanceTo(5000);
    h.scheduler.clear();
    h.scheduler.start();
    h.tick();
    expect(fire).not.toHaveBeenCalled();
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
  describe('an event already inside the window when scheduled', () => {
    const endOfTask = (): Promise<void> => Promise.resolve();

    it('fires at the end of the task, without waiting for a pass', async () => {
      const h = harness();
      const fire = vi.fn();
      h.scheduler.start();
      h.scheduler.schedule(10, fire);
      await endOfTask();
      expect(fire).toHaveBeenCalledWith(10);
    });

    it('fires everything scheduled in the same task in time order, as a pass would', async () => {
      const h = harness();
      const order: number[] = [];
      h.scheduler.start();
      h.scheduler.schedule(50, () => order.push(50));
      h.scheduler.schedule(10, () => order.push(10));
      h.scheduler.schedule(30, () => order.push(30));
      await endOfTask();
      expect(order).toEqual([10, 30, 50]);
    });

    it('fires an earlier event the window has reached since the last pass first', async () => {
      const h = harness();
      const order: number[] = [];
      h.scheduler.start();
      h.scheduler.schedule(110, () => order.push(110));
      h.tick();                          // horizon 100: not yet
      await endOfTask();
      expect(order).toEqual([]);
      h.advanceTo(20);
      h.scheduler.schedule(115, () => order.push(115));
      await endOfTask();
      expect(order).toEqual([110, 115]);
    });

    it('is not fired again by the next pass', async () => {
      const h = harness();
      const fire = vi.fn();
      h.scheduler.start();
      h.scheduler.schedule(10, fire);
      await endOfTask();
      h.tick();
      expect(fire).toHaveBeenCalledTimes(1);
      expect(h.scheduler.pending()).toBe(0);
    });

    it('leaves an event beyond the window for a pass', async () => {
      const h = harness();
      const fire = vi.fn();
      h.scheduler.start();
      h.scheduler.schedule(500, fire);
      await endOfTask();
      expect(fire).not.toHaveBeenCalled();
      expect(h.scheduler.pending()).toBe(1);
    });

    it('fires an event whose time has already passed', async () => {
      const h = harness(1000);
      const fire = vi.fn();
      h.scheduler.start();
      h.scheduler.schedule(200, fire);
      await endOfTask();
      expect(fire).toHaveBeenCalledWith(200);
    });

    it('does not fire what was cancelled later in the same task', async () => {
      const h = harness();
      const fire = vi.fn();
      h.scheduler.start();
      h.scheduler.schedule(10, fire, 'k');
      h.scheduler.cancelKey('k');
      await endOfTask();
      expect(fire).not.toHaveBeenCalled();
    });

    it('does not fire while the scheduler is stopped', async () => {
      const h = harness();
      const never = vi.fn();
      const stopped = vi.fn();
      h.scheduler.schedule(10, never);
      await endOfTask();
      h.scheduler.start();
      h.scheduler.schedule(10, stopped);
      h.scheduler.stop();
      await endOfTask();
      expect(never).not.toHaveBeenCalled();
      expect(stopped).not.toHaveBeenCalled();
      expect(h.scheduler.pending()).toBe(2);
    });

    it('queues one flush per task however many events are scheduled', () => {
      const spy = vi.spyOn(globalThis, 'queueMicrotask');
      const h = harness();
      h.scheduler.start();
      for (let i = 0; i < 5; i += 1) h.scheduler.schedule(i, vi.fn());
      expect(spy).toHaveBeenCalledTimes(1);
      spy.mockRestore();
    });

    it('fires an event a pass callback schedules without waiting for the next pass', async () => {
      const h = harness();
      const inner = vi.fn();
      h.scheduler.start();
      h.scheduler.schedule(10, () => h.scheduler.schedule(20, inner));
      h.tick();
      await endOfTask();
      expect(inner).toHaveBeenCalledWith(20);
    });
  });
});
