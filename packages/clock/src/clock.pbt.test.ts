/**
 * Property tests of the clock. A stateful model test drives random syncs, rates, ramps, seeks, duration and loop
 * writes, declarations, resets, and rebases against a model of where the playhead goes, checking after every step
 * that it stands inside the run with a pass and phase that read it back, and that a mix follows it. Then seek
 * determinism, time scaling composing across frames, ramps reaching their ends exactly, a recorded position
 * reopening where it stood, and a duration write keeping the pass and phase.
 */
import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { clockPosition, createClock } from './clock';
import { shownInPass } from './hold';
import { duration, fakeMix, loop, near, rate, reading, runs, spec, tally, timeoutFor } from './pbt.fixture';
import { passesOf } from './place';
import type { ClockHandle, ClockSpec } from './types';

const RUNS = 200;

/** `slept`: the last sync left the clock inert, so the next one only records the time, as after a rebase. */
interface Model { elapsed: number; rate: number; ramp: { to: number; left: number } | null; now: number; last: number | null; slept: boolean }
interface Real { handle: ClockHandle; mix: ReturnType<typeof fakeMix> }

const t = tally();
const spanOf = (h: ClockHandle): number => h.clock.duration * passesOf(h.clock.loop);

/** What a clock reports must read back where it stands. */
function checkInvariants(h: ClockHandle): void {
  const c = h.clock;
  const span = spanOf(h);
  expect(Number.isFinite(c.elapsed)).toBe(true);
  expect(c.elapsed).toBeGreaterThanOrEqual(0);
  expect(c.elapsed).toBeLessThanOrEqual(span);
  expect(Number.isFinite(c.rate)).toBe(true);
  expect(c.ended).toBe(Number.isFinite(span) && c.elapsed >= span);
  expect(Number.isInteger(c.pass)).toBe(true);
  expect(c.pass).toBeGreaterThanOrEqual(0);
  expect(c.phase).toBeGreaterThanOrEqual(0);
  expect(c.phase).toBeLessThanOrEqual(1);
  if (Number.isFinite(c.duration)) {
    expect(c.pass).toBeLessThanOrEqual(Math.ceil(passesOf(c.loop)) - 1);
    expect(near(c.pass * c.duration + c.phase * c.duration, c.elapsed, c.duration)).toBe(true);
  } else {
    expect(c.pass).toBe(0);
    expect(c.phase).toBe(0);
  }
}

function check(m: Model, r: Real): void {
  checkInvariants(r.handle);
  expect(near(r.handle.clock.elapsed, m.elapsed, spanOf(r.handle))).toBe(true);
  expect(near(r.handle.clock.rate, m.rate)).toBe(true);
}

/** Take up where the real clock stands after a change the model does not reckon itself. */
function adopt(m: Model, r: Real, rampKept = false): void {
  m.elapsed = r.handle.clock.elapsed;
  m.rate = r.handle.clock.rate;
  if (!rampKept) m.ramp = null;
}

type Cmd = fc.Command<Model, Real>;

const syncCmd = fc.oneof(fc.constantFrom(0, 16, 16.7, 100, 1000, 1e4, 1e7), fc.double({ min: 0, max: 5000, noNaN: true })).map((dt): Cmd => ({
    check: () => true,
    run(m, r) {
      m.now += dt;
      if (m.last !== null && !m.slept) {
        // The time the clock can see pass: what is left of `dt` once added to the timestamp.
        const dt = Math.max(0, m.now - m.last);
        const span = spanOf(r.handle);
        let area: number;
        if (!m.ramp) area = m.rate * dt;
        else if (dt >= m.ramp.left) {
          area = ((m.rate + m.ramp.to) / 2) * m.ramp.left + m.ramp.to * (dt - m.ramp.left);
          m.rate = m.ramp.to;
          m.ramp = null;
        } else {
          const next = m.rate + ((m.ramp.to - m.rate) * dt) / m.ramp.left;
          area = ((m.rate + next) / 2) * dt;
          m.rate = next;
          m.ramp = { to: m.ramp.to, left: m.ramp.left - dt };
        }
        m.elapsed += area;
        if (m.elapsed >= span && (m.rate > 0 || area > 0)) { m.elapsed = span; m.rate = 0; m.ramp = null; t.count('end'); }
        else if (m.elapsed <= 0 && (m.rate < 0 || area < 0)) { m.elapsed = 0; m.rate = 0; m.ramp = null; t.count('start'); }
      }
      m.last = m.now;
      m.slept = m.rate === 0 && m.ramp === null;
      r.handle.clock.sync(m.now);
      check(m, r);
      // The mix keeps the clock's time, synced forward and sought back.
      expect(near(r.mix.now, r.handle.clock.elapsed, spanOf(r.handle))).toBe(true);
      t.count('sync');
    },
    toString: () => `sync(+${dt})`,
  }));

const commands = fc.commands([
  syncCmd, syncCmd, syncCmd,
  rate.map((to): Cmd => ({
    check: () => true,
    run(m, r) { r.handle.clock.rate = to; m.rate = to; m.ramp = null; check(m, r); t.count('rate'); },
    toString: () => `rate = ${to}`,
  })),
  fc.tuple(rate, fc.constantFrom(-5, 0, 10, 100, 1000, 333.3)).map(([to, over]): Cmd => ({
    check: () => true,
    run(m, r) {
      r.handle.clock.ramp(to, over);
      if (over > 0) m.ramp = { to, left: over };
      else { m.rate = to; m.ramp = null; }
      check(m, r);
      t.count('ramp');
    },
    toString: () => `ramp(${to}, ${over})`,
  })),
  fc.tuple(fc.oneof(fc.double({ min: -100, max: 1e5, noNaN: true }), fc.constantFrom(0, 3, 100, 200, 250, 1000, 2000, 1e15, -Infinity, Infinity, Number.NaN)), fc.constantFrom('start', 'end' as const)).map(([to, line]): Cmd => ({
    check: () => true,
    run(m, r) {
      const span = spanOf(r.handle);
      const target = Math.min(Math.max(0, to), span);
      if (!Number.isFinite(target)) {
        const before = reading(r.handle.clock);
        expect(() => r.handle.clock.seek(to, line)).toThrow(RangeError);
        expect(reading(r.handle.clock)).toEqual(before);
        t.count('seek:refused');
        return;
      }
      r.handle.clock.seek(to, line);
      m.elapsed = target;
      check(m, r);
      const c = r.handle.clock;
      // On the line between two passes, 'end' stands at the end of the earlier one.
      if (line === 'end' && Number.isFinite(c.duration) && target > 0 && target < span && target % c.duration === 0) {
        expect(c.phase).toBe(1);
        expect(c.pass).toBe(target / c.duration - 1);
        t.count('seek:line');
      }
      t.count('seek');
    },
    toString: () => `seek(${to}, ${line})`,
  })),
  duration.map((d): Cmd => ({
    check: () => true,
    run(m, r) {
      const c = r.handle.clock;
      const was = { pass: c.pass, phase: c.phase, ended: c.ended, finite: Number.isFinite(c.duration) };
      c.duration = d;
      if (was.ended) expect(c.ended).toBe(true);
      else if (was.finite) {
        expect(c.pass).toBe(was.pass);
        // A phase is held only as finely as a double at `elapsed` can tell apart in units of the pass.
        expect(Math.abs(c.phase - was.phase)).toBeLessThanOrEqual(16 * Number.EPSILON * Math.max(1, c.elapsed / c.duration, c.pass + 1));
        t.count('duration:kept');
      }
      adopt(m, r, true);
      check(m, r);
    },
    toString: () => `duration = ${d}`,
  })),
  loop.map((l): Cmd => ({
    check: () => true,
    run(m, r) {
      const c = r.handle.clock;
      const finite = Number.isFinite(c.duration);
      const was = { pass: c.pass, into: c.elapsed - c.pass * c.duration };
      c.loop = l;
      if (finite) {
        const last = Math.ceil(passesOf(l)) - 1;
        expect(c.pass).toBe(Math.min(was.pass, last));
        if (was.pass <= last && passesOf(l) === Math.ceil(passesOf(l))) {
          expect(near(c.elapsed - c.pass * c.duration, was.into, c.duration)).toBe(true);
          t.count('loop:kept');
        }
      }
      adopt(m, r, true);
      check(m, r);
    },
    toString: () => `loop = ${l}`,
  })),
  fc.record({ duration: fc.option(duration, { nil: undefined }), origin: fc.option(fc.constantFrom(0, 40, -10), { nil: undefined }) }).map((s): Cmd => ({
    check: () => true,
    run(m, r) {
      const c = r.handle.clock;
      const before = { pass: c.pass, shown: shownInPass(c), finite: Number.isFinite(c.duration) };
      r.handle.declare({ ...s, loop: c.loop });
      if (before.finite && Number.isFinite(c.duration)) {
        expect(c.pass).toBe(Math.min(before.pass, Math.ceil(passesOf(c.loop)) - 1));
        const within = Math.min(Math.max(0, before.shown - c.origin), c.duration, spanOf(r.handle) - c.pass * c.duration);
        if (c.pass === before.pass) {
          expect(near(shownInPass(c), c.origin + within, c.elapsed + c.duration)).toBe(true);
          t.count('declare:kept');
        }
      }
      adopt(m, r, true);
      check(m, r);
    },
    toString: () => `declare(${JSON.stringify(s)})`,
  })),
  fc.constant<Cmd>({
    check: () => true,
    run(m, r) { r.handle.reset(); adopt(m, r); check(m, r); t.count('reset'); },
    toString: () => 'reset',
  }),
  fc.constant<Cmd>({
    check: () => true,
    run(m, r) { r.handle.clock.rebase(); m.last = null; check(m, r); },
    toString: () => 'rebase',
  }),
], { maxCommands: 30, size: 'large' });

/** Mostly finite runs that play, so ends, lines between passes, and full stops come up often. */
const playing: fc.Arbitrary<ClockSpec> = fc.oneof(
  { weight: 3, arbitrary: fc.record({ duration: fc.constantFrom(100, 250, 1000), loop: fc.constantFrom<boolean | number>(false, 2, 3, 2.5, true), rate: fc.constantFrom(1, 2, -1, 0.5) }) },
  { weight: 2, arbitrary: spec },
);

describe('createClock — stateful model', () => {
  it('stands inside its run, reads back as pass and phase, and moves as the model says', () => {
    fc.assert(fc.property(playing, commands, (s, cmds) => {
      let handle: ClockHandle;
      try { handle = createClock({ ...s, mix: fakeMix }); } catch (e) { expect(e).toBeInstanceOf(RangeError); return; }
      const mix = handle.mix as ReturnType<typeof fakeMix>;
      fc.modelRun(() => ({
        model: { elapsed: handle.clock.elapsed, rate: handle.clock.rate, ramp: null, now: 0, last: null, slept: false },
        real: { handle, mix },
      }), cmds);
    }), runs(RUNS));
    for (const k of ['sync', 'rate', 'ramp', 'seek', 'reset', 'duration:kept', 'declare:kept']) t.atLeast(k, RUNS / 4);
    t.atLeast('end', RUNS / 10);
    for (const k of ['start', 'seek:refused', 'seek:line', 'loop:kept']) t.atLeast(k, 5);
  }, timeoutFor(RUNS, 20));
});

describe('clock laws', () => {
  const ops = fc.array(fc.oneof(
    fc.record({ kind: fc.constant('sync' as const), dt: fc.double({ min: 0, max: 500, noNaN: true }) }),
    fc.record({ kind: fc.constant('rate' as const), to: rate }),
    fc.record({ kind: fc.constant('ramp' as const), to: rate, over: fc.constantFrom(0, 50, 300) }),
    fc.record({ kind: fc.constant('seek' as const), to: fc.double({ min: 0, max: 3000, noNaN: true }) }),
  ), { maxLength: 8 });
  const apply = (h: ClockHandle, list: fc.Arbitrary<unknown> extends never ? never : { kind: string; dt?: number; to?: number; over?: number }[], start = 0): number => {
    let now = start;
    h.clock.sync(now);
    for (const o of list) {
      if (o.kind === 'sync') h.clock.sync((now += o.dt!));
      else if (o.kind === 'rate') h.clock.rate = o.to!;
      else if (o.kind === 'ramp') h.clock.ramp(o.to!, o.over!);
      else h.clock.seek(o.to!);
    }
    return now;
  };
  const finiteSpec = fc.record({ duration, loop: fc.constantFrom<boolean | number>(false, 2, 3, true), rate: fc.option(rate, { nil: undefined }) });

  it('a seek lands in the same place whatever came before it, and the same frames then play out alike', () => {
    fc.assert(fc.property(finiteSpec, ops, ops, fc.double({ min: 0, max: 5000, noNaN: true }), fc.constantFrom('start', 'end' as const), ops, (s, a, b, to, line, after) => {
      const x = createClock(s);
      const y = createClock(s);
      apply(x, a);
      apply(y, b);
      x.clock.seek(to, line);
      y.clock.seek(to, line);
      x.clock.rate = 1;
      y.clock.rate = 1;
      expect(reading(x.clock)).toEqual(reading(y.clock));
      x.clock.rebase();
      y.clock.rebase();
      apply(x, after);
      apply(y, after);
      expect(reading(x.clock)).toEqual(reading(y.clock));
    }), runs(RUNS));
  });

  it('time scaling composes: many frames move the clock as one frame over the same time does', () => {
    const t2 = tally();
    fc.assert(fc.property(
      rate, fc.option(fc.tuple(rate, fc.constantFrom(10, 100, 700)), { nil: undefined }),
      fc.array(fc.double({ min: 0, max: 200, noNaN: true }), { minLength: 1, maxLength: 12 }),
      (r, ramp, frames) => {
        const many = createClock({ rate: r, start: 1e5 });
        const one = createClock({ rate: r, start: 1e5 });
        many.clock.sync(0);
        one.clock.sync(0);
        if (ramp) { many.clock.ramp(...ramp); one.clock.ramp(...ramp); }
        // A clock woken from rest counts time from the sync after the change.
        many.clock.sync(0);
        one.clock.sync(0);
        let now = 0;
        for (const dt of frames) many.clock.sync((now += dt));
        one.clock.sync(now);
        expect(near(many.clock.elapsed, one.clock.elapsed, 1e5)).toBe(true);
        expect(near(many.clock.rate, one.clock.rate)).toBe(true);
        t2.count(ramp ? 'ramp' : 'steady');
      },
    ), runs(RUNS));
    t2.atLeast('ramp', RUNS / 4);
  });

  it('a ramp reaches its rate exactly once its time is up, passing only between its ends', () => {
    fc.assert(fc.property(rate, rate, fc.double({ min: 1, max: 1000, noNaN: true }), fc.array(fc.double({ min: 0, max: 100, noNaN: true }), { minLength: 1, maxLength: 30 }), (from, to, over, frames) => {
      const { clock } = createClock({ rate: from, start: 1e7 });
      clock.sync(0);
      clock.ramp(to, over);
      clock.sync(0);
      let now = 0;
      for (const dt of frames) {
        clock.sync((now += dt));
        if (now < over) {
          expect(clock.rate).toBeGreaterThanOrEqual(Math.min(from, to) - 1e-12);
          expect(clock.rate).toBeLessThanOrEqual(Math.max(from, to) + 1e-12);
        }
      }
      clock.sync(Math.max(now, over));
      expect(clock.rate).toBe(to);
    }), runs(RUNS));
  });

  it('a recorded position reopens where the clock stood', () => {
    const t3 = tally();
    fc.assert(fc.property(spec, ops, fc.option(duration, { nil: undefined }), (s, list, d) => {
      let h: ClockHandle;
      try { h = createClock(s); } catch { return; }
      apply(h, list);
      if (d !== undefined) h.clock.duration = d;
      const at = clockPosition(h.clock, s.duration, s.origin);
      const back = createClock(s, at);
      expect(reading(back.clock)).toEqual(reading(h.clock));
      t3.count(at.passEnd ? 'pass end' : at.duration !== undefined ? 'redurated' : 'plain');
    }), runs(RUNS));
    t3.atLeast('plain', RUNS / 10);
    t3.atLeast('redurated', RUNS / 10);
  });

  it('refuses a declaration it cannot run with a RangeError, never another error', () => {
    const bad = fc.record({
      duration: fc.option(fc.constantFrom(0, -1, Number.NaN, Infinity, 5), { nil: undefined }),
      loop: fc.option(fc.constantFrom<boolean | number>(Number.NaN, 2, true), { nil: undefined }),
      rate: fc.option(fc.constantFrom(Number.NaN, Infinity, -1, 1), { nil: undefined }),
      origin: fc.option(fc.constantFrom(Number.NaN, -Infinity, 3), { nil: undefined }),
      speed: fc.option(fc.constantFrom(0, -1, Number.NaN, Infinity, 2), { nil: undefined }),
      rates: fc.option(fc.constantFrom([], [0], [Number.NaN], [1, 2], [Infinity]), { nil: undefined }),
      start: fc.option(fc.constantFrom<number | 'end'>('end', Number.NaN, 5), { nil: undefined }),
      seekable: fc.option(fc.boolean(), { nil: undefined }),
    }, { requiredKeys: [] });
    fc.assert(fc.property(bad, (s) => {
      try { checkInvariants(createClock(s as ClockSpec)); } catch (e) { expect(e).toBeInstanceOf(RangeError); }
    }), runs(RUNS));
  });
});

describe('shrunk counterexamples', () => {
  it('a pass and its phase read the same place where the quotient and remainder round apart', () => {
    const h = createClock({ start: 50 });
    h.clock.duration = 0.1;
    h.clock.loop = true;
    h.reset();
    expect(h.clock.elapsed).toBe(50);
    expect([h.clock.pass, h.clock.phase]).toEqual([500, 0]);
  });

  it('a loop write keeps a clock at the end of its pass when the end does not divide evenly', () => {
    const h = createClock({});
    h.clock.loop = 3;
    h.clock.seek(250);
    h.clock.duration = 0.000001;
    expect([h.clock.pass, h.clock.phase]).toEqual([2, 1]);
    h.clock.loop = true;
    expect([h.clock.pass, h.clock.phase]).toEqual([2, 1]);
  });

  it('a declaration keeps a clock near the start of its pass there, when the time within it rounds away', () => {
    const h = createClock({ start: 1e9 });
    h.clock.loop = true;
    h.clock.duration = 0.0010000000000000002;
    const pass = h.clock.pass;
    h.declare({ duration: 100, loop: true });
    expect(h.clock.pass).toBe(pass);
    expect(h.clock.phase).toBe(0);
  });
});
