/**
 * Property tests of holds and the registry. `holdAt` pauses a clock at a shown time in its first pass and keeps it
 * there through declarations and duration writes until something else moves it; `holdElapsed` of a recorded
 * position brings a clock back where the recorded one stood. The registry against a plain model of its entries.
 */
import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { clockPosition, createClock } from './clock';
import { holdAt, holdElapsed, shownInPass } from './hold';
import { duration, near, rate, reading, runs, spec, tally, timeoutFor } from './pbt.fixture';
import { createClockRegistry, type ClockTarget } from './registry';
import type { ClockHandle, ClockSpec } from './types';

const RUNS = 300;
const finite = fc.record({
  duration, loop: fc.constantFrom<boolean | number>(false, 2, 3, true), rate: fc.option(rate, { nil: undefined }),
  origin: fc.option(fc.constantFrom(0, 100, -20), { nil: undefined }),
});

/** Where `holdAt(…, shown)` puts `h`'s clock: the shown time in the first pass, clamped to it. */
const heldAt = (h: ClockHandle, shown: number | null): number => {
  const c = h.clock;
  const within = Math.min(shown === null ? 0 : shown - c.origin, c.duration);
  return Math.min(Math.max(0, within), c.duration * (c.loop === true ? Infinity : c.loop === false ? 1 : Math.max(1, c.loop)));
};

describe('holdAt', () => {
  it('pauses at the shown time in the first pass, follows the span, and lets go when something else moves it', () => {
    const t = tally();
    fc.assert(fc.property(
      finite, fc.option(fc.oneof(fc.double({ min: -200, max: 5000, noNaN: true }), fc.constantFrom(0, 100, 250)), { nil: null }),
      fc.array(fc.oneof(
        fc.record({ kind: fc.constant('declare' as const), duration: fc.option(duration, { nil: undefined }), origin: fc.option(fc.constantFrom(0, 50, -10), { nil: undefined }) }),
        fc.record({ kind: fc.constant('duration' as const), duration }),
      ), { maxLength: 4 }),
      fc.constantFrom('rate', 'seek', 'none' as const),
      (s, shown, moves, ending) => {
        const h = createClock(s);
        h.clock.sync(0);
        const hold = holdAt(h, shown);
        expect(h.clock.rate).toBe(0);
        for (const mv of [{ kind: 'none' as const }, ...moves]) {
          if (mv.kind === 'declare') h.declare({ ...s, duration: mv.duration ?? s.duration, origin: mv.origin, loop: h.clock.loop });
          else if (mv.kind === 'duration') h.clock.duration = mv.duration;
          const c = h.clock;
          expect(near(c.elapsed, heldAt(h, shown), c.duration)).toBe(true);
          if (Number.isFinite(c.duration)) expect(c.pass).toBe(0);
          const reached = shown === null || c.origin + c.elapsed === shown;
          expect(hold.pending()).toBe(reached ? null : shown);
          t.count(reached ? 'reached' : 'pending');
        }
        if (ending === 'rate') h.clock.rate = 1;
        else if (ending === 'seek') h.clock.seek(h.clock.elapsed === 0 ? 1 : 0);
        if (ending !== 'none') {
          expect(hold.pending()).toBeNull();
          t.count('released');
        }
        hold.release();
        hold.release();
        expect(hold.pending()).toBeNull();
      },
    ), runs(RUNS));
    t.atLeast('reached', RUNS / 2);
    t.atLeast('pending', RUNS / 4);
    t.atLeast('released', RUNS / 2);
  }, timeoutFor(RUNS, 3));
});

describe('holdElapsed', () => {
  it('brings a clock back where a recorded one stood, pass and all', () => {
    const t = tally();
    const looping: fc.Arbitrary<ClockSpec> = fc.oneof({ weight: 1, arbitrary: spec }, { weight: 3, arbitrary: fc.record({ duration: fc.constantFrom(100, 250, 0.1), loop: fc.constantFrom<boolean | number>(2, 3, 2.5, true), origin: fc.option(fc.constantFrom(0, 30), { nil: undefined }) }) });
    fc.assert(fc.property(looping, fc.array(fc.double({ min: 0, max: 400, noNaN: true }), { maxLength: 6 }), fc.option(fc.oneof(fc.constantFrom(150, 350, 200, 500), fc.double({ min: 0, max: 5000, noNaN: true })), { nil: undefined }), (s, frames, seek) => {
      let a: ClockHandle;
      try { a = createClock({ ...s, rate: s.rate ?? 1 }); } catch { return; }
      let now = 0;
      a.clock.sync(now);
      for (const dt of frames) a.clock.sync((now += dt));
      if (seek !== undefined) a.clock.seek(seek, 'end');
      const at = clockPosition(a.clock, s.duration, s.origin);
      const b = createClock(s);
      const hold = holdElapsed(b, at);
      const { rate: _ra, ...ra } = reading(a.clock);
      const { rate: _rb, ...rb } = reading(b.clock);
      expect(rb).toEqual(ra);
      expect(hold.pending()).toBeNull();
      expect(shownInPass(b.clock)).toBe(shownInPass(a.clock));
      t.count(a.clock.pass > 0 ? 'later pass' : 'first pass');
    }), runs(RUNS));
    t.atLeast('later pass', RUNS / 20);
    t.atLeast('first pass', RUNS / 4);
  }, timeoutFor(RUNS, 3));
});

describe('createClockRegistry — stateful model', () => {
  interface Entry { handle: number; target: number | null; token: number }
  interface Model { entries: Map<string, Entry>; notified: number; next: number }
  interface Real { reg: ReturnType<typeof createClockRegistry>; handles: ClockHandle[]; targets: ClockTarget[]; releases: Map<number, () => void>; notified: number; shared: ClockHandle | null }
  const ids = fc.constantFrom('a', 'b', '__proto__', 'constructor');
  type Cmd = fc.Command<Model, Real>;

  const check = (m: Model, r: Real): void => {
    for (const id of ['a', 'b', '__proto__', 'constructor']) {
      const e = m.entries.get(id);
      expect(r.reg.get(id)).toBe(e ? r.handles[e.handle] : null);
    }
    const all = new Set<ClockHandle>([...(r.shared ? [r.shared] : []), ...[...m.entries.values()].map((e) => r.handles[e.handle]!)]);
    expect(new Set(r.reg.all())).toEqual(all);
    expect([...r.reg.all()].length).toBe(all.size);
    r.handles.forEach((h, i) => {
      const mine = [...m.entries.values()].filter((e) => e.handle === i);
      const want = mine.some((e) => e.target === null) ? [] : mine.map((e) => r.targets[e.target!]);
      expect(r.reg.targets(h)).toEqual(want);
    });
    expect(r.notified).toBe(m.notified);
  };

  const commands = fc.commands([
    fc.tuple(ids, fc.integer({ min: 0, max: 2 }), fc.option(fc.integer({ min: 0, max: 2 }), { nil: null })).map(([id, handle, target]): Cmd => ({
      check: () => true,
      run(m, r) {
        const token = m.next++;
        m.entries.set(id, { handle, target, token });
        m.notified++;
        r.releases.set(token, r.reg.register(id, r.handles[handle]!, target === null ? undefined : r.targets[target]));
        check(m, r);
      },
      toString: () => `register(${id}, ${handle}, ${target})`,
    })),
    fc.nat().map((i): Cmd => ({
      check: (m) => m.next > 0,
      run(m, r) {
        const token = i % m.next;
        const live = [...m.entries].find(([, e]) => e.token === token);
        if (live) { m.entries.delete(live[0]); m.notified++; }
        r.releases.get(token)?.();
        check(m, r);
      },
      toString: () => `release(${i})`,
    })),
  ], { maxCommands: 25 });

  it('holds each id\'s newest registration until its own release, and reports every change', () => {
    fc.assert(fc.property(fc.boolean(), commands, (withShared, cmds) => {
      const handles = [createClock({}), createClock({ duration: 100 }), createClock({ rate: 1 })];
      const shared = withShared ? handles[0]! : null;
      const reg = createClockRegistry(shared);
      const real: Real = { reg, handles, targets: [() => ({}), () => null, () => ({ n: 2 })], releases: new Map(), notified: 0, shared };
      reg.subscribe(() => { real.notified++; });
      fc.modelRun(() => ({ model: { entries: new Map(), notified: 0, next: 0 }, real }), cmds);
    }), runs(RUNS));
  }, timeoutFor(RUNS, 3));
});

describe('shrunk counterexamples', () => {
  it('a declaration that changes nothing leaves a held clock held', () => {
    const h = createClock({ duration: 0.001, loop: false });
    h.clock.sync(0);
    const hold = holdAt(h, 0);
    h.declare({ duration: 0.001, loop: false, origin: -10 });
    h.declare({ duration: 0.001, loop: false, origin: -10 });
    expect(hold.pending()).toBe(0);
    expect(h.clock.elapsed).toBe(0.001);
  });
});
