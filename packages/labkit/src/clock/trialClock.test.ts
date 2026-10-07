import { describe, expect, it, vi } from 'vitest';
import { createTrialClock } from './trialClock';

/** A clock already synced once at t=0, so the next sync advances it. */
function started(...args: Parameters<typeof createTrialClock>) {
  const c = createTrialClock(...args);
  c.clock.sync(0);
  return c;
}

describe('createTrialClock', () => {
  it('opens paused at 0, and inert', () => {
    const { clock } = createTrialClock({});
    expect(clock.elapsed).toBe(0);
    expect(clock.rate).toBe(0);
    expect(clock.inert).toBe(true);
  });

  it('opens at the declared rate', () => {
    const { clock } = createTrialClock({ rate: 2 });
    expect(clock.rate).toBe(2);
    expect(clock.inert).toBe(false);
  });

  it('advances by rate times real time', () => {
    const { clock } = started({ rate: 2 });
    clock.sync(100);
    expect(clock.elapsed).toBe(200);
  });

  it('records the time on its first sync without advancing', () => {
    const { clock } = createTrialClock({ rate: 1 });
    clock.sync(5000);
    expect(clock.elapsed).toBe(0);
    clock.sync(5016);
    expect(clock.elapsed).toBe(16);
  });

  it('plays backward at a negative rate', () => {
    const { clock } = started({ rate: -1 }, { elapsed: 500, rate: -1 });
    clock.sync(200);
    expect(clock.elapsed).toBe(300);
  });

  it('does not charge a sleep to the clock when it wakes', () => {
    const { clock } = started({ rate: 1 });
    clock.sync(10);
    expect(clock.elapsed).toBe(10);
    clock.rate = 0;
    clock.sync(20);
    expect(clock.inert).toBe(true);
    clock.rate = 1;
    clock.sync(100_000);
    expect(clock.elapsed).toBe(10);
    clock.sync(100_016);
    expect(clock.elapsed).toBe(26);
  });

  it('drops the time between a rebase and the next sync', () => {
    const { clock } = started({ rate: 1 });
    clock.sync(100);
    clock.rebase();
    clock.sync(60_000);
    expect(clock.elapsed).toBe(100);
    clock.sync(60_010);
    expect(clock.elapsed).toBe(110);
  });

  describe('ends', () => {
    it('holds at the end of a run and pauses', () => {
      const listener = vi.fn();
      const { clock } = started({ duration: 1000, rate: 1 });
      clock.subscribe(listener);
      clock.sync(1500);
      expect(clock.elapsed).toBe(1000);
      expect(clock.rate).toBe(0);
      expect(listener).toHaveBeenCalled();
    });

    it('holds at 0 playing backward and pauses', () => {
      const { clock } = started({ duration: 1000 }, { elapsed: 100, rate: -1 });
      clock.sync(500);
      expect(clock.elapsed).toBe(0);
      expect(clock.rate).toBe(0);
    });

    it('never ends with no duration', () => {
      const { clock } = started({ rate: 1 });
      clock.sync(1e9);
      expect(clock.elapsed).toBe(1e9);
      expect(clock.rate).toBe(1);
    });

    it('runs n passes when loop is n, counting them', () => {
      const { clock } = started({ duration: 100, loop: 3, rate: 1 });
      clock.sync(250);
      expect(clock.pass).toBe(2);
      expect(clock.phase).toBeCloseTo(0.5);
      clock.sync(400);
      expect(clock.elapsed).toBe(300);
      expect(clock.pass).toBe(2);
      expect(clock.phase).toBe(1);
      expect(clock.rate).toBe(0);
    });

    it('loops forever on loop: true, the phase wrapping both ways', () => {
      const { clock } = started({ duration: 100, loop: true, rate: 1 });
      clock.sync(1050);
      expect(clock.pass).toBe(10);
      expect(clock.phase).toBeCloseTo(0.5);
      clock.rate = -1;
      clock.sync(1050);
      clock.sync(1150);
      expect(clock.pass).toBe(9);
      expect(clock.phase).toBeCloseTo(0.5);
    });

    it('plays once by default', () => {
      const { clock } = started({ duration: 100, rate: 1 });
      clock.sync(150);
      expect(clock.elapsed).toBe(100);
    });
  });

  describe('seek', () => {
    it('is absolute, across passes', () => {
      const { clock } = createTrialClock({ duration: 100, loop: true });
      clock.seek(250);
      expect(clock.elapsed).toBe(250);
      expect(clock.pass).toBe(2);
    });

    it('clamps to the run', () => {
      const { clock } = createTrialClock({ duration: 100, loop: 2 });
      clock.seek(-5);
      expect(clock.elapsed).toBe(0);
      clock.seek(999);
      expect(clock.elapsed).toBe(200);
    });

    it('wakes a paused clock for one frame', () => {
      const wake = vi.fn();
      const { clock } = started({});
      clock.onWake(wake);
      clock.seek(50);
      expect(wake).toHaveBeenCalledTimes(1);
      expect(clock.inert).toBe(false);
      clock.sync(16);
      expect(clock.inert).toBe(true);
    });
  });

  describe('seekable: false', () => {
    it('throws on any seek', () => {
      const { clock } = createTrialClock({ seekable: false });
      expect(() => clock.seek(0)).toThrow();
      expect(() => clock.seek(10)).toThrow();
    });

    it('throws on a negative rate, set or ramped', () => {
      const { clock } = createTrialClock({ seekable: false });
      expect(() => {
        clock.rate = -1;
      }).toThrow();
      expect(() => clock.ramp(-1, 100)).toThrow();
    });

    it('still resets to 0 at its declared rate', () => {
      const c = started({ seekable: false, rate: 1 });
      c.clock.sync(500);
      c.clock.rate = 3;
      c.reset();
      expect(c.clock.elapsed).toBe(0);
      expect(c.clock.rate).toBe(1);
    });
  });

  describe('ramp', () => {
    it('moves rate linearly and integrates position', () => {
      const { clock } = started({ rate: 0 });
      clock.ramp(2, 100);
      clock.sync(10); // woken: records the time
      clock.sync(110);
      expect(clock.rate).toBe(2);
      expect(clock.elapsed).toBeCloseTo(100);
      clock.sync(160);
      expect(clock.elapsed).toBeCloseTo(200);
    });

    it('finishes mid-frame and runs on at the new rate', () => {
      const { clock } = started({ rate: 1 });
      clock.ramp(3, 100);
      clock.sync(200);
      expect(clock.rate).toBe(3);
      expect(clock.elapsed).toBeCloseTo(200 + 300);
    });

    it('is replaced by a rate write', () => {
      const { clock } = started({ rate: 1 });
      clock.ramp(5, 1000);
      clock.rate = 0;
      clock.sync(500);
      expect(clock.elapsed).toBe(0);
    });
  });

  describe('notifications', () => {
    it('subscribe fires on rate, seek and loop changes, not per frame', () => {
      const listener = vi.fn();
      const { clock } = started({ rate: 1, duration: 1000 });
      clock.subscribe(listener);
      clock.sync(16);
      clock.sync(32);
      expect(listener).not.toHaveBeenCalled();
      clock.rate = 2;
      clock.seek(10);
      clock.loop = true;
      expect(listener).toHaveBeenCalledTimes(3);
    });

    it('onWake fires once until the next sync', () => {
      const wake = vi.fn();
      const { clock } = started({});
      clock.onWake(wake);
      clock.rate = 1;
      clock.rate = 2;
      expect(wake).toHaveBeenCalledTimes(1);
      clock.sync(16);
      clock.rate = 0;
      expect(wake).toHaveBeenCalledTimes(2);
    });

    it('onFrame fires after a sync that moved the clock, with elapsed and pass', () => {
      const frame = vi.fn();
      const c = started({ rate: 1, duration: 100, loop: true });
      c.onFrame(frame);
      c.clock.sync(150);
      expect(frame).toHaveBeenCalledWith(150, 1);
      c.clock.rate = 0;
      c.clock.sync(160);
      frame.mockClear();
      c.clock.sync(170);
      expect(frame).not.toHaveBeenCalled();
    });

    it('onFrame fires once after a seek, though paused', () => {
      const frame = vi.fn();
      const c = started({});
      c.onFrame(frame);
      c.clock.seek(40);
      c.clock.sync(16);
      expect(frame).toHaveBeenCalledWith(40, 0);
    });
  });

  it('rejects a rate that is not a finite number', () => {
    const { clock } = createTrialClock({});
    expect(() => {
      clock.rate = Number.NaN;
    }).toThrow();
    expect(() => {
      clock.rate = Number.POSITIVE_INFINITY;
    }).toThrow();
  });
});
