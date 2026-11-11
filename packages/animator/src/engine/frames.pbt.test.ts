/**
 * Metamorphic rules over a hosted animator's frames: one frame step split into many reaches the
 * same state, a turn and its undoing leave everything where it was, and time a hidden tab spent
 * between `suspended` and `resumed` is charged to nothing.
 */
import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import type { AnimationHandle } from '../types';
import { clocked, runs, tally, timeoutFor } from '../pbt.fixture';

const RUNS = 200;

const value = fc.integer({ min: -1000, max: 1000 });
const duration = fc.integer({ min: 1, max: 800 });
/** Cuts of `total` into ascending frame times ending on it. */
const cuts = (total: number): fc.Arbitrary<number[]> =>
  fc.array(fc.integer({ min: 1, max: Math.max(1, total - 1) }), { maxLength: 12 })
    .map((cs) => [...new Set(cs.filter((c) => c < total))].sort((a, b) => a - b).concat(total));

type Kind = 'tween' | 'spring' | 'decay';
const kind = fc.constantFrom<Kind>('tween', 'spring', 'decay');

/** Starts one animation of `k` on `h`, recording each value and its end. */
function start(h: ReturnType<typeof clocked>, k: Kind, from: number, to: number, ms: number) {
  const seen = { last: Number.NaN, done: 0, handle: null as unknown as AnimationHandle };
  const onTick = (v: number): void => { seen.last = v; };
  const onDone = (): void => { seen.done++; };
  if (k === 'tween') seen.handle = h.animator.tween({ from, to, ms, easing: 'easeInOutQuad', onTick, onDone });
  else if (k === 'spring') seen.handle = h.animator.spring({ from, to, velocity: ms / 10, stiffness: 120, damping: 14, onTick, onDone });
  else seen.handle = h.animator.decay({ from, velocity: ms * 2, add: (a, b) => a + b, scale: (v, k) => v * k, magnitude: Math.abs, onTick, onDone });
  return seen;
}

describe('animator frames, property', () => {
  it('reaches the same value in one frame as in many frames to the same time', () => {
    const t = tally();
    fc.assert(fc.property(kind, value, value, duration, fc.integer({ min: 1, max: 1500 }).chain((T) => fc.tuple(fc.constant(T), cuts(T))),
      (k, from, to, ms, [T, times]) => {
        const one = clocked(), many = clocked();
        one.at(0); many.at(0);
        const a = start(one, k, from, to, ms), b = start(many, k, from, to, ms);
        one.at(T);
        for (const at of times) many.at(at);
        // A spring or a coast rests at the first frame that finds it slow and near enough, so frames
        // between can find it at rest earlier, where one frame later finds it past that window.
        if (k !== 'tween' && b.done > a.done) { t.count('rested on a frame between'); return; }
        expect(b.done).toBe(a.done);
        if (a.done === 0) {
          expect(b.last).toBeCloseTo(a.last, 6);
          t.count(`${k} midway`);
        } else expect(b.last).toBe(a.last);
      }), runs(RUNS));
    for (const k of ['tween', 'spring', 'decay']) t.atLeast(`${k} midway`, 10);
  }, timeoutFor(RUNS, 5));

  it('turned backward and forward again with no frame between, plays on as if never turned', () => {
    fc.assert(fc.property(kind, value, value, duration, fc.integer({ min: 1, max: 400 }), fc.integer({ min: 1, max: 400 }), fc.boolean(),
      (k, from, to, ms, first, rest, own) => {
        const plain = clocked(), turned = clocked();
        plain.at(0); turned.at(0);
        const a = start(plain, k, from, to, ms), b = start(turned, k, from, to, ms);
        plain.at(first); turned.at(first);
        if (own) { b.handle.setTimeScale(-1); b.handle.setTimeScale(1); }
        else { turned.animator.setTimeScale(-1); turned.animator.setTimeScale(1); }
        plain.at(first + rest); turned.at(first + rest);
        expect(b.done).toBe(a.done);
        expect(b.last).toBeCloseTo(a.last, 6);
      }), runs(RUNS));
  }, timeoutFor(RUNS, 5));

  it('played forward a while and back as long, stands where it started the back', () => {
    const t = tally();
    fc.assert(fc.property(value, value, fc.integer({ min: 100, max: 800 }), fc.integer({ min: 1, max: 99 }), fc.integer({ min: 1, max: 99 }), cuts(50),
      (from, to, ms, at, back, steps) => {
        const fwd = clocked();
        const seen = { last: Number.NaN };
        fwd.at(0);
        fwd.animator.tween({ from, to, ms, easing: 'linear', onTick: (v) => { seen.last = v; } });
        fwd.at(at);
        const there = seen.last;
        const span = Math.min(back, at - 1);
        if (span <= 0) return;
        fwd.animator.setTimeScale(-1);
        for (const s of steps) fwd.at(at + (s * span) / 50);
        fwd.animator.setTimeScale(1);
        for (const s of steps) fwd.at(at + span + (s * span) / 50);
        expect(seen.last).toBeCloseTo(there, 6);
        t.count('retraced');
      }), runs(RUNS));
    t.atLeast('retraced', 50);
  }, timeoutFor(RUNS, 5));

  it('charges nothing for the time between `suspended` and `resumed`', () => {
    fc.assert(fc.property(kind, value, value, duration, fc.integer({ min: 0, max: 500 }), fc.oneof(fc.integer({ min: 1, max: 3_600_000 }), fc.constantFrom(1e12, 1e300)),
      fc.integer({ min: 1, max: 400 }),
      (k, from, to, ms, before, gap, after) => {
        const plain = clocked(), hidden = clocked();
        plain.at(0); hidden.at(0);
        const a = start(plain, k, from, to, ms), b = start(hidden, k, from, to, ms);
        plain.at(before); hidden.at(before);
        hidden.suspended();
        hidden.resumed();
        // The resuming frame advances nothing; the frame after it advances as plain's one does.
        hidden.at(before + gap);
        plain.at(before);
        hidden.at(before + gap + after);
        // Far out, the frame times resolve less than a ms: plain is charged what hidden's clock saw.
        plain.at(before + ((before + gap + after) - (before + gap)));
        expect(b.done).toBe(a.done);
        expect(b.last).toBeCloseTo(a.last, 6);
      }), runs(RUNS));
  }, timeoutFor(RUNS, 5));
});
