import { kit, type Mix, mix, patch, sum } from '@msb235/blits';
import { describe, expect, it } from 'vitest';
import { createClock } from './clock';

interface Pose {
  x: number;
}
const K = kit<Pose>({ x: sum() });
const part = 'part';
/** x climbs from 0 to 100 over one second. */
const climb = patch<string, Pose>(1000, (phase) => ({ x: phase * 100 }), {
  writes: ['x'],
});

function trial(start?: { elapsed: number; rate: number }, keep?: number) {
  let made: Mix<string, Pose> | undefined;
  const handle = createClock(
    { duration: 2000, rate: 1, keep, mix: (transport) => (made = mix<string, Pose>(K, { transport })) },
    start,
  );
  const m = made!;
  handle.clock.sync(0);
  return { ...handle, m, x: () => m.probe(part).x };
}

describe('a trial clock with a mix', () => {
  it('keeps the mix at the clock as it plays', () => {
    const { clock, m, x } = trial();
    m.cue({ patch: climb, loop: false });
    clock.sync(400);
    expect(m.now).toBe(400);
    expect(x()).toBeCloseTo(40);
  });

  it('seeks the mix back with the clock, and plays a later cue again going forward', () => {
    const { clock, m, x } = trial();
    clock.sync(500);
    m.cue({ patch: climb, loop: false });
    clock.sync(800);
    expect(x()).toBeCloseTo(30);

    clock.rate = 0;
    clock.seek(200);
    clock.sync(816);
    expect(m.now).toBe(200);
    expect(x()).toBe(0);

    clock.seek(700);
    clock.sync(832);
    expect(x()).toBeCloseTo(20);
  });

  it('plays the mix backward on a negative rate', () => {
    const { clock, m, x } = trial();
    m.cue({ patch: climb, loop: false });
    clock.sync(600);
    clock.rate = -1;
    clock.sync(800);
    expect(m.now).toBe(400);
    expect(x()).toBeCloseTo(40);
  });

  it('takes the mix back to 0 on reset', () => {
    const { clock, m, reset } = trial();
    clock.sync(600);
    reset();
    clock.sync(616);
    expect(clock.elapsed).toBe(16);
    expect(m.now).toBe(16);
  });

  it('opens a reopened trial with the mix at the clock', () => {
    const { m } = trial({ elapsed: 300, rate: 0 });
    expect(m.now).toBe(300);
  });
});

describe('the history a clock with a mix keeps', () => {
  it('stops at the end of a run a long frame overshoots, and seeks back over the whole run', () => {
    const { clock, m } = trial();
    clock.sync(1e7);
    expect(clock.elapsed).toBe(2000);
    expect(clock.rate).toBe(0);
    expect(m.now).toBe(2000);
    clock.seek(0);
    clock.sync(1e7 + 16);
    expect(clock.elapsed).toBe(0);
    expect(m.now).toBe(0);
  });

  it('lands a seek back past `keep` on the earliest time kept', () => {
    const { clock, m } = trial(undefined, 500);
    clock.sync(1500);
    clock.rate = 0;
    clock.seek(0);
    expect(clock.elapsed).toBeGreaterThanOrEqual(1000);
    expect(clock.elapsed).toBeLessThan(1500);
    expect(m.now).toBe(clock.elapsed);
  });

  it('refuses a `keep` that is not positive', () => {
    for (const keep of [0, -1, Number.NaN])
      expect(() =>
        createClock({ duration: 100, keep, mix: (transport) => mix<string, Pose>(K, { transport }) }),
      ).toThrow(RangeError);
  });
});
