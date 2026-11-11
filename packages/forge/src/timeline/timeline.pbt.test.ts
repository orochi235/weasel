/**
 * A story's playhead: seconds in the URL read back as the ms written, any declared span gives a clock that can be
 * made, seeking lands on the shown time clamped to the span, and play, pause and speed on a clock no transport works
 * follow a model through any sequence.
 */
import { type ClockHandle, createClock } from '@weasel-js/clock';
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { anyFinite, runs, tally, timeoutFor } from '../pbt.fixture';
import { clockSpecOf, spanOverrideOf } from './clockSpec';
import { ownMoves, type PlayMoves } from './moves';
import { formatSeconds, parseSeconds } from './playheadUrl';
import { seekShown, shownTime } from './shown';

const RUNS = 300;

const anyNumber = fc.oneof({ weight: 6, arbitrary: anyFinite }, { weight: 1, arbitrary: fc.constantFrom(Number.NaN, Infinity, -Infinity) });

describe('playhead seconds', () => {
  it('read back as the whole ms written, for any finite ms', () => {
    const seen = tally();
    fc.assert(
      fc.property(anyFinite, (ms) => {
        const text = formatSeconds(ms);
        const back = parseSeconds(text);
        const want = Math.round(ms) === 0 ? 0 : Math.round(ms);
        // Past 2^53 a whole ms is any double, and the trip through seconds may move it by an ulp.
        if (Math.abs(want) <= 2 ** 53) expect(back, text).toBe(want);
        else expect(Math.abs(back! - want) / Math.abs(want), text).toBeLessThanOrEqual(1e-15);
        if (Math.abs(ms) >= 1e21) seen.count('huge');
      }),
      runs(RUNS),
    );
    seen.atLeast('huge', 10);
  }, timeoutFor(RUNS, 1));

  it('parse any text as a finite whole ms or refuse it', () => {
    const text = fc.oneof(
      fc.string({ maxLength: 8 }),
      fc.stringMatching(/^-?\d{0,400}(\.\d{0,3})?$/),
      fc.constantFrom('1e3', '1e400', 'Infinity', 'NaN', ' 1.5 ', '.5', '5.', '-0', '0x10', '', '9'.repeat(400)),
    );
    fc.assert(
      fc.property(text, (t) => {
        const ms = parseSeconds(t);
        if (ms === null) return;
        expect(Number.isFinite(ms)).toBe(true);
        expect(Number.isInteger(ms)).toBe(true);
      }),
      runs(RUNS),
    );
  }, timeoutFor(RUNS, 1));
});

describe('clockSpecOf', () => {
  it('gives a clock that can be made from any declared span', () => {
    fc.assert(
      fc.property(anyNumber, fc.option(anyNumber, { nil: undefined }), fc.option(fc.boolean(), { nil: undefined }), fc.option(anyNumber, { nil: undefined }), (duration, start, loop, rate) => {
        const spec = clockSpecOf({ duration, ...(start === undefined ? {} : { start }), ...(loop === undefined ? {} : { loop }), ...(rate === undefined ? {} : { rate }) });
        expect(Number.isFinite(spec.duration) && spec.duration! > 0).toBe(true);
        expect(Number.isFinite(spec.origin)).toBe(true);
        expect(Number.isFinite(spec.speed) && spec.speed! > 0).toBe(true);
        const handle = createClock(spec);
        const span = spanOverrideOf({ duration, ...(start === undefined ? {} : { start }) });
        handle.override(span);
        expect(handle.clock.duration).toBe(span.duration);
        expect(handle.clock.origin).toBe(span.origin);
      }),
      runs(RUNS),
    );
  }, timeoutFor(RUNS, 1));
});

const span = fc.record({
  duration: fc.oneof(fc.integer({ min: 1, max: 10_000 }), fc.double({ min: 1e-3, max: 1e9, noNaN: true })),
  start: fc.oneof(fc.integer({ min: -5000, max: 5000 }), fc.double({ min: -1e9, max: 1e9, noNaN: true })),
  loop: fc.boolean(),
});

describe('seekShown', () => {
  it('stands the playhead at the time asked for, clamped to the span', () => {
    const seen = tally();
    fc.assert(
      fc.property(span, fc.array(anyNumber, { minLength: 1, maxLength: 4 }), ({ duration, start, loop }, times) => {
        const { clock } = createClock(clockSpecOf({ duration, start, loop }));
        for (const t of times) {
          seekShown(clock, t);
          const want = Number.isNaN(t) ? clock.origin : Math.min(Math.max(t, clock.origin), clock.origin + clock.duration);
          const shown = shownTime(clock);
          expect(Number.isFinite(shown)).toBe(true);
          expect(Math.abs(shown - want)).toBeLessThanOrEqual(1e-9 * Math.max(1, Math.abs(clock.origin), clock.duration));
          if (t >= clock.origin + clock.duration) seen.count('at the end');
          else if (t > clock.origin) seen.count('inside');
        }
      }),
      runs(RUNS),
    );
    seen.atLeast('at the end', 30);
    seen.atLeast('inside', 30);
  }, timeoutFor(RUNS, 1));
});

interface Model {
  /** The speed set with `setSpeed`, if any. */
  kept: number | null;
  playing: boolean;
}
interface Real {
  handle: ClockHandle;
  moves: PlayMoves;
  now: number;
}

const SPEEDS = [0.25, 0.5, 1, 2, 4];

class Play implements fc.Command<Model, Real> {
  check = (): boolean => true;
  run(m: Model, r: Real): void {
    const before = r.handle.clock.rate;
    r.moves.play();
    if (before === 0) {
      m.playing = true;
      expect(r.handle.clock.rate).toBe(m.kept ?? r.handle.clock.speed);
    } else expect(r.handle.clock.rate).toBe(before);
  }
  toString = (): string => 'play';
}
class Pause implements fc.Command<Model, Real> {
  check = (): boolean => true;
  run(m: Model, r: Real): void {
    r.moves.pause();
    m.playing = false;
    expect(r.handle.clock.rate).toBe(0);
  }
  toString = (): string => 'pause';
}
class SetSpeed implements fc.Command<Model, Real> {
  constructor(readonly speed: number) {}
  check = (): boolean => true;
  run(m: Model, r: Real): void {
    r.moves.setSpeed(this.speed);
    m.kept = this.speed;
    expect(r.handle.clock.rate).toBe(m.playing ? this.speed : 0);
  }
  toString = (): string => `setSpeed(${this.speed})`;
}
class Frame implements fc.Command<Model, Real> {
  constructor(readonly dt: number) {}
  check = (): boolean => true;
  run(m: Model, r: Real): void {
    r.handle.clock.sync((r.now += this.dt));
    if (r.handle.clock.rate === 0) m.playing = false;
  }
  toString = (): string => `frame(${this.dt})`;
}

describe('ownMoves', () => {
  it('play, pause and speed follow the model through any sequence', () => {
    const seen = tally();
    const commands = fc.commands(
      [
        fc.constant(new Play()),
        fc.constant(new Pause()),
        fc.constantFrom(...SPEEDS).map((s) => new SetSpeed(s)),
        fc.integer({ min: 0, max: 3000 }).map((dt) => new Frame(dt)),
      ],
      { maxCommands: 25 },
    );
    fc.assert(
      fc.property(span, fc.option(fc.constantFrom(...SPEEDS), { nil: undefined }), commands, ({ duration, start, loop }, rate, cmds) => {
        const handle = createClock({ ...clockSpecOf({ duration, start, loop, ...(rate === undefined ? {} : { rate }) }) });
        const moves = ownMoves(handle.clock);
        const model: Model = { kept: null, playing: false };
        fc.modelRun(() => ({ model, real: { handle, moves, now: 0 } }), cmds);
        expect(moves.speed()).toBe(model.kept ?? (Math.abs(handle.clock.rate) || handle.clock.speed));
        if (String(cmds).includes('setSpeed') && String(cmds).includes('play')) seen.count('mixed');
      }),
      runs(RUNS),
    );
    seen.atLeast('mixed', 50);
  }, timeoutFor(RUNS, 2));
});

describe('shrunk counterexamples', () => {
  it('reads back a playhead past 1e21 seconds, which formatSeconds writes with an exponent', () => {
    expect(formatSeconds(1e24)).toBe('1e+21');
    expect(parseSeconds(formatSeconds(1e24))).toBe(1e24);
  });

  it('refuses seconds too large for a finite ms', () => {
    expect(parseSeconds('9'.repeat(400))).toBeNull();
  });
});
