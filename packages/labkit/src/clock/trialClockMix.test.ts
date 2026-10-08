import { kit, mix, patch, sum } from '@msb235/blits';
import { createHistory } from '@weasel-js/history';
import { describe, expect, it } from 'vitest';
import { createTrialClock } from './trialClock';

interface Pose {
  x: number;
}
const K = kit<Pose>({ x: sum() });
const part = 'part';
/** x climbs from 0 to 100 over one second. */
const climb = patch<string, Pose>(1000, (phase) => ({ x: phase * 100 }), { writes: ['x'] });

function trial(start?: { elapsed: number; rate: number }) {
  const m = mix<string, Pose>(K, { history: { ms: 10_000, tape: createHistory } });
  const handle = createTrialClock({ duration: 2000, rate: 1, mix: () => m }, start);
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
