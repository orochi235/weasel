/**
 * Metamorphic rules over a timeline's playhead: one frame split into many lands the same and
 * fires the same events, a seek and then playback reaches what playing from the start does, and
 * a turn backward undone before a frame leaves playback as it was.
 */
import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { clocked, runs, tally, timeoutFor } from '../pbt.fixture';
import { build, plan, type Built, type Plan } from './timeline.fixture';

const RUNS = 150;

/** Ascending frame times ending on `total`. */
const cuts = (total: number): fc.Arbitrary<number[]> =>
  fc.array(fc.integer({ min: 1, max: Math.max(1, total - 1) }), { maxLength: 15 })
    .map((cs) => [...new Set(cs.filter((c) => c < total))].sort((a, b) => a - b).concat(total));

const ids = (b: Built): string[] => b.fired.map((f) => f.id).sort();

/** A timeline of `p` on its own animator, its clock at 0. */
function started(p: Plan) {
  const b = build(p);
  const h = clocked();
  h.at(0);
  let done = 0;
  const tl = h.animator.timeline({ tracks: b.tracks, duration: p.duration, onDone: () => { done++; } });
  return { b, h, tl, done: () => done };
}

describe('timeline playhead, property', () => {
  it('lands, samples, and fires the same in one frame as in many frames to the same time', () => {
    const t = tally();
    fc.assert(fc.property(plan, fc.integer({ min: 1, max: 700 }).chain((T) => fc.tuple(fc.constant(T), cuts(T))), (p, [T, times]) => {
      const one = started(p), many = started(p);
      one.h.at(T);
      for (const at of times) many.h.at(at);
      expect(many.tl.time()).toBe(one.tl.time());
      expect(many.b.ticks.at(-1)).toBe(one.b.ticks.at(-1));
      expect(ids(many.b)).toEqual(ids(one.b));
      expect(many.done()).toBe(one.done());
      if (one.b.fired.length > 1 && times.length > 2) t.count('split firing');
    }), runs(RUNS));
    t.atLeast('split firing', 30);
  }, timeoutFor(RUNS, 10));

  it('sought to `s` and played on, stands, samples, and fires as one played from the start through `s`', () => {
    const t = tally();
    fc.assert(fc.property(plan, fc.integer({ min: 0, max: 600 }), fc.integer({ min: 1, max: 400 }), cuts(400),
      (p, s, run, steps) => {
        const from0 = started(p), sought = started(p);
        const d = from0.tl.duration();
        if (s > d) return;
        const at = (u: number): number => s + Math.floor((u * run) / 400);
        for (const u of steps) from0.h.at(at(u));
        sought.tl.seek(s);
        for (const u of steps) sought.h.at(at(u) - s);
        expect(sought.tl.time()).toBe(from0.tl.time());
        expect(sought.b.ticks.at(-1)).toBe(from0.b.ticks.at(-1));
        const after = from0.b.fired.filter((f) => from0.b.times.get(f.id)! >= s);
        expect(ids(sought.b)).toEqual(ids({ ...from0.b, fired: after }));
        expect(sought.done()).toBe(from0.done());
        if (after.length > 0 && s > 0) t.count('fired past the seek');
      }), runs(RUNS));
    t.atLeast('fired past the seek', 30);
  }, timeoutFor(RUNS, 10));

  it('turned backward and forward again with no frame between, plays on as if never turned', () => {
    fc.assert(fc.property(plan, fc.integer({ min: 0, max: 400 }), cuts(400), fc.constantFrom(-0.5, -1, -2), fc.boolean(),
      (p, first, steps, back, global) => {
        const plain = started(p), turned = started(p);
        plain.h.at(first); turned.h.at(first);
        if (global) { turned.h.animator.setTimeScale(back); turned.h.animator.setTimeScale(1); }
        else { turned.tl.setTimeScale(back); turned.tl.setTimeScale(1); }
        for (const u of steps) { plain.h.at(first + u); turned.h.at(first + u); }
        expect(turned.tl.time()).toBe(plain.tl.time());
        expect(turned.b.ticks.at(-1)).toBe(plain.b.ticks.at(-1));
        expect(turned.b.fired.map((f) => f.id)).toEqual(plain.b.fired.map((f) => f.id));
        expect(turned.done()).toBe(plain.done());
      }), runs(RUNS));
  }, timeoutFor(RUNS, 10));

  it('played back a while and forward as long, stands where it turned, firing again just what it passed back over', () => {
    const t = tally();
    fc.assert(fc.property(plan, fc.integer({ min: 1, max: 400 }), fc.integer({ min: 1, max: 400 }), (p, first, back) => {
      const { b, h, tl } = started(p);
      h.at(first);
      const there = tl.time();
      if (there <= 0 || there >= tl.duration()) return;
      // Short of 0, where a timeline played backward ends.
      const span = Math.min(back, Math.floor(there) - 1);
      if (span <= 0) return;
      const firedThen = b.fired.length;
      tl.setTimeScale(-1);
      h.at(first + span);
      expect(b.fired.length).toBe(firedThen);
      tl.setTimeScale(1);
      h.at(first + 2 * span);
      expect(tl.time()).toBeCloseTo(there, 9);
      // Played back, the cursor stands where it stopped, and forward again it fires from there.
      const passed = b.fired.slice(0, firedThen).filter((f) => { const at = b.times.get(f.id)!; return at > there - span && at <= there; });
      expect(ids({ ...b, fired: b.fired.slice(firedThen) })).toEqual(ids({ ...b, fired: passed }));
      t.count(passed.length > 0 ? 'fired again' : 'retraced');
    }), runs(RUNS));
    t.atLeast('retraced', 20);
    t.atLeast('fired again', 20);
  }, timeoutFor(RUNS, 10));
});
