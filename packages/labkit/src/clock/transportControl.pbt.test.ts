/**
 * Stateful property test of a transport over a trial clock: random plays, pauses, toggles, speed and direction
 * changes, seeks, and frames, through a fresh `transportControl` each time as a transport re-renders, against a
 * model of the speed and direction it holds. Every step checks the clock's signed rate and the hold; a seek lands
 * the playhead at its time held to the current pass, and leaves the pass where it was.
 */
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { runs, tally, timeoutFor } from '../pbt.fixture';
import { transportControl } from './transportControl';
import { transportHoldOf } from './transportHold';
import { createTrialClock, type TrialClock } from './trialClock';

const RUNS = 200;

interface Model {
  speed: number;
  backward: boolean;
}

interface Real {
  clock: TrialClock;
  now: number;
}

const t = tally();

const control = (r: Real) => {
  const hold = transportHoldOf(r.clock);
  return transportControl(r.clock, hold.get(), hold.set, hold.touch);
};

const signed = (m: Model, clock: TrialClock): number =>
  m.backward && clock.seekable ? -m.speed : m.speed;

function check(m: Model, r: Real, rate: number): void {
  expect(r.clock.rate).toBe(rate);
  const held = transportHoldOf(r.clock).get();
  expect(held.speed).toBe(m.speed);
  expect(held.backward).toBe(m.backward);
  expect(control(r).playing).toBe(rate !== 0);
}

type Act = 'play' | 'pause' | 'toggle';

class Press implements fc.Command<Model, Real> {
  constructor(readonly act: Act) {}
  check = (): boolean => true;
  run(m: Model, r: Real): void {
    const was = r.clock.rate;
    const plays = this.act === 'play' || (this.act === 'toggle' && was === 0);
    if (this.act === 'toggle') t.count(was === 0 ? 'toggled on' : 'toggled off');
    control(r)[this.act]();
    check(m, r, plays ? signed(m, r.clock) : 0);
  }
  toString = (): string => this.act;
}

class Speed implements fc.Command<Model, Real> {
  constructor(
    readonly by: number | 1 | -1,
    readonly step: boolean,
  ) {}
  check = (): boolean => true;
  run(m: Model, r: Real): void {
    const was = r.clock.rate;
    if (this.step) {
      const rates = r.clock.rates;
      const next =
        this.by > 0
          ? rates.find((x) => x > m.speed)
          : [...rates].reverse().find((x) => x < m.speed);
      t.count(next === undefined ? 'stepped past the end' : 'stepped');
      if (next !== undefined) m.speed = next;
      control(r).stepSpeed(this.by > 0 ? 1 : -1);
    } else {
      m.speed = this.by;
      control(r).setSpeed(this.by);
    }
    check(m, r, was === 0 ? 0 : signed(m, r.clock));
  }
  toString = (): string => (this.step ? `stepSpeed(${this.by})` : `setSpeed(${this.by})`);
}

class Backward implements fc.Command<Model, Real> {
  constructor(readonly backward: boolean) {}
  check = (): boolean => true;
  run(m: Model, r: Real): void {
    const was = r.clock.rate;
    if (r.clock.seekable) m.backward = this.backward;
    else t.count('direction refused');
    control(r).setBackward(this.backward);
    check(m, r, was === 0 ? 0 : signed(m, r.clock));
  }
  toString = (): string => `setBackward(${this.backward})`;
}

class Seek implements fc.Command<Model, Real> {
  constructor(readonly frac: number) {}
  check = (): boolean => true;
  run(m: Model, r: Real): void {
    const c = control(r);
    const { clock } = r;
    const rate = clock.rate;
    const ms = c.start + this.frac * c.length;
    const pass = clock.pass;
    const elapsed = clock.elapsed;
    c.seek(ms);
    if (!c.scrubs) {
      t.count('seek refused');
      expect(clock.elapsed).toBe(elapsed);
    } else {
      t.count(this.frac < 0 ? 'sought before' : this.frac >= 1 ? 'sought past' : 'sought within');
      const d = clock.duration;
      const span =
        d *
        (clock.loop === true
          ? Number.POSITIVE_INFINITY
          : clock.loop === false
            ? 1
            : Math.max(1, clock.loop));
      const passLength = Math.min((pass + 1) * d, span) - pass * d;
      const want = clock.origin + Math.min(Math.max(ms - clock.origin, 0), passLength);
      expect(clock.pass).toBe(pass);
      expect(Math.abs(control(r).playhead - want)).toBeLessThanOrEqual(1e-9 * (1 + Math.abs(want)));
    }
    check(m, r, rate);
  }
  toString = (): string => `seek(${this.frac})`;
}

class Frame implements fc.Command<Model, Real> {
  constructor(readonly ms: number) {}
  check = (): boolean => true;
  run(_m: Model, r: Real): void {
    r.now += this.ms;
    r.clock.sync(r.now);
    if (r.clock.ended) t.count('ended');
  }
  toString = (): string => `frame(${this.ms})`;
}

const spec = fc
  .record({
    duration: fc.constantFrom(100, 1000, 3000, 7, Number.POSITIVE_INFINITY),
    origin: fc.constantFrom(0, -1000, 250, 1e6),
    loop: fc.constantFrom<boolean | number>(false, true, 2, 2.5),
    seekable: fc.boolean(),
    speed: fc.constantFrom(0.25, 1, 2, 3),
    rate: fc.constantFrom(0, 1, 2),
    start: fc.constantFrom(0, 50, 'end' as const),
  })
  .filter((s) => s.start !== 'end' || (s.loop !== true && Number.isFinite(s.duration)));

const commands = [
  fc.constantFrom<Act>('play', 'pause', 'toggle').map((a) => new Press(a)),
  fc.constantFrom(0.25, 0.5, 1, 2, 4, 3).map((s) => new Speed(s, false)),
  fc.constantFrom(1, -1).map((s) => new Speed(s, true)),
  fc.boolean().map((b) => new Backward(b)),
  fc.constantFrom(-0.5, 0, 0.3, 0.5, 0.999, 1, 1.5).map((f) => new Seek(f)),
  fc.constantFrom(16, 250, 5000).map((ms) => new Frame(ms)),
];

describe('a transport over a trial clock', () => {
  it(
    'plays at the speed and direction it holds, and seeks within the current pass',
    () => {
      fc.assert(
        fc.property(spec, fc.commands(commands, { maxCommands: 30, size: '+1' }), (s, cmds) => {
          const { clock } = createTrialClock(s);
          const now = 1000;
          clock.sync(now);
          const held = transportHoldOf(clock).get();
          fc.modelRun(
            () => ({ model: { speed: held.speed, backward: held.backward }, real: { clock, now } }),
            cmds,
          );
        }),
        runs(RUNS),
      );
      for (const what of [
        'toggled on',
        'toggled off',
        'stepped',
        'stepped past the end',
        'direction refused',
        'seek refused',
        'sought before',
        'sought past',
        'sought within',
        'ended',
      ])
        t.atLeast(what, 20);
    },
    timeoutFor(RUNS, 10),
  );
});
