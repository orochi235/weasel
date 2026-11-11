/**
 * Loops, tween loops, and staggers on a hosted animator: a turn backward undone before a frame
 * leaves them as they were, an outside clock played forward drives them as their own frames do,
 * and stagger delays at the edges of the number line start where they say.
 */
import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { clocked, runs, tally, timeoutFor } from './pbt.fixture';

const RUNS = 150;
const value = fc.integer({ min: -1000, max: 1000 });
const frameTimes = fc.array(fc.integer({ min: 1, max: 120 }), { minLength: 1, maxLength: 30 })
  .map((ds) => ds.reduce<number[]>((out, d) => [...out, (out.at(-1) ?? 0) + d], []));
const direction = fc.constantFrom<'restart' | 'reverse' | 'alternate'>('restart', 'reverse', 'alternate');

function looped(h: ReturnType<typeof clocked>, from: number, to: number, ms: number, count: number, dir: 'restart' | 'reverse' | 'alternate') {
  const seen = { last: Number.NaN, done: 0 };
  const handle = h.animator.tweenLoop({ from, to, ms, count, direction: dir, easing: 'linear', onTick: (v) => { seen.last = v; }, onDone: () => { seen.done++; } });
  return { seen, handle };
}

describe('loops and staggers, property', () => {
  it('a tween loop turned backward and forward again with no frame between plays on as if never turned', () => {
    fc.assert(fc.property(value, value, fc.integer({ min: 10, max: 200 }), fc.integer({ min: 1, max: 5 }), direction, fc.integer({ min: 1, max: 300 }), frameTimes, fc.boolean(),
      (from, to, ms, count, dir, first, times, own) => {
        const plain = clocked(), turned = clocked();
        plain.at(0); turned.at(0);
        const a = looped(plain, from, to, ms, count, dir), b = looped(turned, from, to, ms, count, dir);
        plain.at(first); turned.at(first);
        if (own) { b.handle.setTimeScale(-1); b.handle.setTimeScale(1); }
        else { turned.animator.setTimeScale(-1); turned.animator.setTimeScale(1); }
        for (const at of times) { plain.at(first + at); turned.at(first + at); }
        expect(b.seen.done).toBe(a.seen.done);
        expect(b.seen.last).toBeCloseTo(a.seen.last, 6);
      }), runs(RUNS));
  }, timeoutFor(RUNS, 10));

  it('an outside clock played forward drives tweens, springs, loops, and staggers as their own frames do', () => {
    fc.assert(fc.property(value, value, fc.integer({ min: 10, max: 300 }), direction, fc.array(fc.integer({ min: 0, max: 400 }), { maxLength: 5 }), frameTimes,
      (from, to, ms, dir, delays, times) => {
        const run = (drive: (h: ReturnType<typeof clocked>, t: number) => void): number[] => {
          const h = clocked();
          drive(h, 0);
          const out: number[] = [];
          const push = (i: number) => (v: number): void => { out[i] = v; };
          h.animator.tween({ from, to, ms, easing: 'easeInOutQuad', onTick: push(0) });
          h.animator.spring({ from, to, onTick: push(1) });
          h.animator.tweenLoop({ from, to, ms, count: 3, direction: dir, easing: 'linear', onTick: push(2) });
          h.animator.stagger(delays, (i) => delays[i]!, (_d, i) => h.animator.tween({ from, to, ms, onTick: push(3 + i) }));
          for (const at of times) drive(h, at);
          return out;
        };
        const own = run((h, t) => h.at(t));
        const followed = run((h, t) => h.follow(t, 1));
        expect(followed.length).toBe(own.length);
        own.forEach((v, i) => expect(followed[i]).toBeCloseTo(v, 6));
      }), runs(RUNS));
  }, timeoutFor(RUNS, 10));

  it('starts each stagger item on the first frame at or past its delay, whatever the delay', () => {
    const t = tally();
    const delay = fc.oneof(fc.integer({ min: -100, max: 1000 }), fc.constantFrom(-0, 5e-324, 0.5, 1e15, 1e300, Number.MAX_VALUE, -Number.MAX_VALUE));
    fc.assert(fc.property(fc.array(delay, { minLength: 1, maxLength: 6 }), frameTimes, fc.constantFrom('wave', '__proto__', 'constructor'),
      (delays, times, key) => {
        const h = clocked();
        h.at(0);
        const started: { i: number; at: number }[] = [];
        let now = 0;
        h.animator.stagger(delays, (i) => delays[i]!, (_d, i) => {
          started.push({ i, at: now });
          return h.animator.tween({ from: 0, to: 1, ms: 10, onTick: () => {} });
        }, { cancelKey: key });
        expect(h.animator.isActive(key)).toBe(true);
        for (const at of times) { now = at; h.at(at); }
        for (const [i, d] of delays.entries()) {
          const s = started.find((x) => x.i === i);
          const due = Math.max(0, d);
          if (due > now) { expect(s, `item ${i} at ${d}`).toBeUndefined(); t.count('waiting'); continue; }
          expect(s, `item ${i} at ${d}`).toBeDefined();
          expect(s!.at).toBeGreaterThanOrEqual(due);
          const before = [0, ...times].filter((x) => x < due).at(-1) ?? 0;
          expect(s!.at === 0 || before < due).toBe(true);
        }
        expect(h.animator.isActive(key)).toBe(started.length < delays.length || h.animator.isActive());
        h.animator.cancelKey(key);
        expect(h.animator.isActive(key)).toBe(false);
      }), runs(RUNS));
    t.atLeast('waiting', 30);
  }, timeoutFor(RUNS, 10));
});
