/**
 * Second-pass property tests of the clock's calls: a call it refuses changes nothing, now or later; frame times in
 * any order and at any magnitude keep the playhead finite and inside its run; a model of when it wakes, reports a
 * frame, and notifies; pausing over a gap moves it as a rebase over the gap does; and a hold keeps its place through
 * overrides, loop writes, and frames.
 */
import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { createClock } from './clock';
import { holdAt } from './hold';
import { duration, loop, near, rate, reading, runs, tally, timeoutFor } from './pbt.fixture';
import { passesOf } from './place';
import type { ClockHandle, ClockSpec } from './types';

const RUNS = 200;

type Op =
  | { kind: 'sync'; dt: number }
  | { kind: 'rate'; to: number }
  | { kind: 'ramp'; to: number; over: number }
  | { kind: 'seek'; to: number; line: 'start' | 'end' }
  | { kind: 'duration'; to: number }
  | { kind: 'loop'; to: boolean | number }
  | { kind: 'declare'; spec: ClockSpec }
  | { kind: 'override'; span: { duration?: number; origin?: number } | null }
  | { kind: 'reset' }
  | { kind: 'rebase' };

const origin = fc.constantFrom(0, 40, -10, 1000);
const op: fc.Arbitrary<Op> = fc.oneof(
  { weight: 4, arbitrary: fc.record({ kind: fc.constant('sync' as const), dt: fc.oneof(fc.constantFrom(0, 16, 100, 1000), fc.double({ min: 0, max: 3000, noNaN: true })) }) },
  fc.record({ kind: fc.constant('rate' as const), to: rate }),
  fc.record({ kind: fc.constant('ramp' as const), to: rate, over: fc.constantFrom(0, 10, 300) }),
  fc.record({ kind: fc.constant('seek' as const), to: fc.double({ min: 0, max: 5000, noNaN: true }), line: fc.constantFrom('start', 'end' as const) }),
  fc.record({ kind: fc.constant('duration' as const), to: duration }),
  fc.record({ kind: fc.constant('loop' as const), to: loop }),
  fc.record({ kind: fc.constant('declare' as const), spec: fc.record({ duration: fc.option(duration, { nil: undefined }), origin: fc.option(origin, { nil: undefined }), loop: fc.option(loop, { nil: undefined }) }, { requiredKeys: [] }) }),
  fc.record({ kind: fc.constant('override' as const), span: fc.option(fc.record({ duration: fc.option(duration, { nil: undefined }), origin: fc.option(origin, { nil: undefined }) }, { requiredKeys: [] }), { nil: null }) }),
  fc.constant<Op>({ kind: 'reset' }),
  fc.constant<Op>({ kind: 'rebase' }),
);

/** Apply `o` to `h`, the frame time kept in `now`. */
function apply(h: ClockHandle, o: Op, now: { t: number }): void {
  const c = h.clock;
  switch (o.kind) {
    case 'sync': c.sync((now.t += o.dt)); break;
    case 'rate': c.rate = o.to; break;
    case 'ramp': c.ramp(o.to, o.over); break;
    case 'seek': c.seek(o.to, o.line); break;
    case 'duration': c.duration = o.to; break;
    case 'loop': c.loop = o.to; break;
    case 'declare': h.declare(o.spec); break;
    case 'override': h.override(o.span); break;
    case 'reset': h.reset(); break;
    case 'rebase': c.rebase(); break;
  }
}

/** Calls a seekable clock refuses, each with what it throws. */
const refused: fc.Arbitrary<{ name: string; call: (h: ClockHandle) => void }> = fc.oneof(
  fc.constantFrom(Number.NaN, Infinity, -Infinity).map((v) => ({ name: `rate = ${v}`, call: (h: ClockHandle) => { h.clock.rate = v; } })),
  fc.tuple(fc.constantFrom(Number.NaN, Infinity, 1), fc.constantFrom(Number.NaN, Infinity, -Infinity, 10)).filter(([to, over]) => !(Number.isFinite(to) && Number.isFinite(over)))
    .map(([to, over]) => ({ name: `ramp(${to}, ${over})`, call: (h: ClockHandle) => h.clock.ramp(to, over) })),
  fc.constantFrom(Number.NaN).map((v) => ({ name: `seek(${v})`, call: (h: ClockHandle) => h.clock.seek(v) })),
  fc.constantFrom(0, -1, Number.NaN, -Infinity).map((v) => ({ name: `duration = ${v}`, call: (h: ClockHandle) => { h.clock.duration = v; } })),
  fc.constant({ name: 'loop = NaN', call: (h: ClockHandle) => { h.clock.loop = Number.NaN; } }),
  fc.record({
    duration: fc.constantFrom<number | undefined>(0, -1, Number.NaN, undefined, 100),
    origin: fc.constantFrom<number | undefined>(Number.NaN, Infinity, undefined, 5),
    loop: fc.constantFrom<boolean | number | undefined>(Number.NaN, undefined, 2),
    speed: fc.constantFrom<number | undefined>(0, -2, Number.NaN, undefined, 1),
  }).filter((s) => !(s.duration !== undefined && s.duration > 0 && (s.origin === undefined || Number.isFinite(s.origin))
      && (s.loop === undefined || !Number.isNaN(s.loop)) && (s.speed === undefined || s.speed > 0)))
    .filter((s) => !(s.duration === undefined && (s.origin === undefined || Number.isFinite(s.origin)) && (s.loop === undefined || !Number.isNaN(s.loop)) && (s.speed === undefined || s.speed > 0)))
    .map((s) => ({ name: `declare(${JSON.stringify(s)})`, call: (h: ClockHandle) => h.declare(s as ClockSpec) })),
  fc.record({
    duration: fc.constantFrom<number | undefined>(0, -1, Number.NaN, undefined, 50),
    origin: fc.constantFrom<number | undefined>(Number.NaN, -Infinity, undefined, 5),
  }).filter((s) => !((s.duration === undefined || s.duration > 0) && (s.origin === undefined || Number.isFinite(s.origin))))
    .map((s) => ({ name: `override(${JSON.stringify(s)})`, call: (h: ClockHandle) => h.override(s) })),
);

const playing: fc.Arbitrary<ClockSpec> = fc.record({
  duration: fc.option(fc.constantFrom(100, 250, 1000), { nil: undefined }),
  loop: fc.option(fc.constantFrom<boolean | number>(false, 2, 2.5, true), { nil: undefined }),
  rate: fc.option(fc.constantFrom(0, 1, -1, 2), { nil: undefined }),
  origin: fc.option(origin, { nil: undefined }),
}, { requiredKeys: [] });

describe('refused calls', () => {
  it('a call the clock refuses changes nothing, then or after', () => {
    const t = tally();
    fc.assert(fc.property(playing, fc.array(op, { maxLength: 10 }), refused, fc.array(op, { maxLength: 10 }), (s, before, bad, after) => {
      const x = createClock(s);
      const y = createClock(s);
      const nx = { t: 0 };
      const ny = { t: 0 };
      for (const o of before) { apply(x, o, nx); apply(y, o, ny); }
      let heard = 0;
      x.clock.subscribe(() => { heard++; });
      expect(() => bad.call(x)).toThrow(RangeError);
      expect(heard).toBe(0);
      expect(reading(x.clock)).toEqual(reading(y.clock));
      for (const o of after) { apply(x, o, nx); apply(y, o, ny); }
      expect(reading(x.clock)).toEqual(reading(y.clock));
      t.count(bad.name.replace(/[ (=].*/, ''));
    }), runs(RUNS));
    for (const k of ['rate', 'ramp', 'seek', 'duration', 'loop', 'declare', 'override']) t.atLeast(k, RUNS / 20);
  }, timeoutFor(RUNS, 3));
});

const spanOf = (h: ClockHandle): number => h.clock.duration * passesOf(h.clock.loop);

describe('frame times', () => {
  const stamp = fc.oneof(
    fc.double({ noNaN: true, noDefaultInfinity: true }),
    fc.constantFrom(0, -0, 1e308, -1e308, Number.MAX_VALUE, -Number.MAX_VALUE, 5e-324, 1e15, -1e15),
    fc.double({ min: -1e4, max: 1e4, noNaN: true }),
  );
  it('frame times in any order and at any magnitude keep the playhead finite and inside its run', () => {
    const t = tally();
    fc.assert(fc.property(
      playing, fc.array(fc.oneof({ weight: 3, arbitrary: stamp.map((at) => ({ at })) }, op), { minLength: 1, maxLength: 16 }),
      (s, list) => {
        const h = createClock(s);
        const now = { t: 0 };
        for (const o of list) {
          if ('at' in o) h.clock.sync(o.at);
          else apply(h, o, now);
          const c = h.clock;
          expect(Number.isFinite(c.elapsed)).toBe(true);
          expect(c.elapsed).toBeGreaterThanOrEqual(0);
          expect(c.elapsed).toBeLessThanOrEqual(spanOf(h));
          expect(Number.isFinite(c.rate)).toBe(true);
          expect(c.phase).toBeGreaterThanOrEqual(0);
          expect(c.phase).toBeLessThanOrEqual(1);
        }
        t.count(Number.isFinite(spanOf(h)) ? 'finite' : 'endless');
      },
    ), runs(RUNS));
    t.atLeast('endless', RUNS / 10);
  }, timeoutFor(RUNS, 3));
});

interface Seen { wakes: number; frames: number; subs: number }

describe('wakes, frames, and notices — model', () => {
  it('wakes once per change between syncs, reports a frame only after a move or a change, and sleeps when inert', () => {
    const t = tally();
    fc.assert(fc.property(playing, fc.array(op, { minLength: 1, maxLength: 30 }), (s, list) => {
      const h = createClock(s);
      const c = h.clock;
      const seen: Seen = { wakes: 0, frames: 0, subs: 0 };
      c.onWake(() => { seen.wakes++; });
      h.onFrame(() => { seen.frames++; });
      c.subscribe(() => { seen.subs++; });
      const now = { t: 0 };
      // Whether a change since the last sync has woken it: the next change does not wake it again.
      let woke = false;
      let changed = false;
      for (const o of list) {
        const was = { ...seen, elapsed: c.elapsed, inert: c.inert, rate: c.rate, duration: c.duration };
        apply(h, o, now);
        if (o.kind === 'sync') {
          if (was.inert) {
            expect(c.elapsed).toBe(was.elapsed);
            expect(seen.frames).toBe(was.frames);
            t.count('inert sync');
          } else {
            expect(seen.frames - was.frames).toBe(c.elapsed !== was.elapsed || changed ? 1 : 0);
          }
          expect(seen.wakes).toBe(was.wakes);
          woke = false;
          changed = false;
          continue;
        }
        if (o.kind === 'rebase' || (o.kind === 'duration' && o.to === was.duration)) { expect(seen).toEqual({ wakes: was.wakes, frames: was.frames, subs: was.subs }); continue; }
        // Every other call is a change: one notice, a wake unless one is out since the last sync, and not inert.
        expect(seen.subs - was.subs).toBe(1);
        expect(seen.wakes - was.wakes).toBe(woke ? 0 : 1);
        expect(seen.frames).toBe(was.frames);
        expect(c.inert).toBe(false);
        woke = true;
        changed = true;
        t.count(o.kind);
      }
    }), runs(RUNS));
    for (const k of ['rate', 'seek', 'declare', 'override', 'inert sync']) t.atLeast(k, RUNS / 10);
  }, timeoutFor(RUNS, 3));
});

describe('pausing and rebasing', () => {
  it('a pause over a gap moves the clock as a rebase over the gap does', () => {
    fc.assert(fc.property(
      fc.constantFrom(1, 2, -1, 0.5), fc.double({ min: 0, max: 500, noNaN: true }), fc.double({ min: 0, max: 1e6, noNaN: true }),
      fc.array(fc.double({ min: 0, max: 200, noNaN: true }), { maxLength: 6 }),
      (r, first, gap, frames) => {
        const spec = { duration: 1000, loop: 3, rate: r, start: 1500 };
        const paused = createClock(spec);
        const rebased = createClock(spec);
        for (const c of [paused.clock, rebased.clock]) { c.sync(0); c.sync(first); }
        paused.clock.rate = 0;
        paused.clock.sync(first + gap);
        paused.clock.rate = r;
        paused.clock.sync(first + gap);
        rebased.clock.rebase();
        rebased.clock.sync(first + gap);
        let now = first + gap;
        for (const dt of frames) { now += dt; paused.clock.sync(now); rebased.clock.sync(now); }
        expect(near(paused.clock.elapsed, rebased.clock.elapsed, 3000)).toBe(true);
        expect(paused.clock.rate).toBe(rebased.clock.rate);
      },
    ), runs(RUNS));
  }, timeoutFor(RUNS, 2));
});

describe('holdAt under overrides, loops, and frames', () => {
  it('keeps the clock paused at the shown time in its first pass through overrides, loop writes, and syncs', () => {
    const t = tally();
    const move = fc.oneof(
      fc.record({ kind: fc.constant('override' as const), span: fc.option(fc.record({ duration: fc.option(duration, { nil: undefined }), origin: fc.option(origin, { nil: undefined }) }, { requiredKeys: [] }), { nil: null }) }),
      fc.record({ kind: fc.constant('loop' as const), to: loop }),
      fc.record({ kind: fc.constant('sync' as const), dt: fc.constantFrom(0, 16, 1000) }),
      fc.record({ kind: fc.constant('declare' as const), spec: fc.record({ duration: fc.option(duration, { nil: undefined }), origin: fc.option(origin, { nil: undefined }) }, { requiredKeys: [] }) }),
    );
    fc.assert(fc.property(playing, fc.option(fc.oneof(fc.double({ min: -100, max: 3000, noNaN: true }), fc.constantFrom(0, 100, 250)), { nil: null }), fc.array(move, { maxLength: 8 }), (s, shown, moves) => {
      const h = createClock({ duration: 500, ...s });
      const now = { t: 0 };
      h.clock.sync(0);
      const hold = holdAt(h, shown);
      for (const mv of moves) {
        apply(h, mv.kind === 'declare' ? { kind: 'declare', spec: { ...mv.spec, loop: h.clock.loop } } : mv, now);
        const c = h.clock;
        expect(c.rate).toBe(0);
        const span = c.duration * passesOf(c.loop);
        const want = Math.min(Math.max(0, Math.min(shown === null ? 0 : shown - c.origin, c.duration)), span);
        expect(near(c.elapsed, want, c.duration)).toBe(true);
        if (Number.isFinite(c.duration)) expect(c.pass).toBe(0);
        const reached = shown === null || c.origin + c.elapsed === shown;
        expect(hold.pending()).toBe(reached ? null : shown);
        t.count(mv.kind);
      }
    }), runs(RUNS));
    for (const k of ['override', 'loop', 'sync']) t.atLeast(k, RUNS / 4);
  }, timeoutFor(RUNS, 3));
});

describe('shrunk counterexamples', () => {
  it('a declaration it refuses is not kept for the next override', () => {
    const h = createClock({});
    expect(() => h.declare({ duration: 0 })).toThrow(RangeError);
    expect(() => h.override(null)).not.toThrow();
  });

  it('an override it refuses is not kept for the next declaration', () => {
    const h = createClock({ duration: 100 });
    expect(() => h.override({ duration: -1 })).toThrow(RangeError);
    h.declare({ duration: 200 });
    expect(h.clock.duration).toBe(200);
  });
});

describe('shrunk counterexamples, under an override', () => {
  it('a declaration is refused for a bad duration of its own while an override stands over it', () => {
    const h = createClock({});
    h.override({ duration: 0.001 });
    expect(() => h.declare({ duration: 0 })).toThrow(RangeError);
    h.override(null);
    expect(h.clock.duration).toBe(Infinity);
  });

  it('an endless clock synced across a gap past the double range stays finite', () => {
    const { clock } = createClock({ rate: 2 });
    clock.sync(-1e308);
    clock.sync(0);
    expect(clock.elapsed).toBe(Number.MAX_VALUE);
    expect(clock.rate).toBe(2);
  });

  it('a ramp to rest across a gap past the double range does not make the playhead NaN', () => {
    const { clock } = createClock({ duration: 1000, rate: 1 });
    clock.sync(-1e308);
    clock.ramp(0, 10);
    clock.sync(1e308);
    expect(clock.elapsed).toBe(5);
  });
});
