/**
 * The animator at the edges of its number line: tweens of no length, sub-ms, subnormal, huge, and
 * endless; frames far along the clock and jumps across the whole range; springs at extreme
 * constants; and keys and labels named like `Object.prototype` members.
 */
import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { clocked, runs, tally, timeoutFor } from '../pbt.fixture';

const RUNS = 200;

const value = fc.integer({ min: -1000, max: 1000 });
const edgeMs = fc.oneof(
  fc.integer({ min: 1, max: 800 }),
  fc.double({ min: 0, max: 1, noNaN: true }),
  fc.constantFrom(0, -0, -1, -Infinity, 5e-324, 1e-300, 0.5, 1e15, 1e300, Number.MAX_VALUE, Infinity),
);
/** Frame times, ascending, from anywhere on the line. */
const edgeTimes = fc.array(fc.oneof(
  fc.integer({ min: 0, max: 2000 }),
  fc.double({ min: 0, max: 1, noNaN: true }),
  fc.constantFrom(5e-324, 1e15, 1e300, Number.MAX_VALUE),
), { minLength: 1, maxLength: 12 }).map((ds) => ds.reduce<number[]>((out, d) => [...out, Math.min(Number.MAX_VALUE, (out.at(-1) ?? 0) + d)], []));

describe('animator edges, property', () => {
  it('a tween of any length shows its elapsed share of the way, finite, and ends once, exactly on `to`, when its time is up', () => {
    const t = tally();
    fc.assert(fc.property(value, value, edgeMs, edgeTimes, (from, to, ms, times) => {
      const h = clocked();
      h.at(0);
      const seen: number[] = [];
      let done = 0;
      h.animator.tween({ from, to, ms, easing: 'linear', onTick: (v) => seen.push(v), onDone: () => { done++; } });
      for (const at of times) {
        const before = seen.length;
        h.at(at);
        if (seen.length === before) continue;
        const v = seen.at(-1)!;
        expect(Number.isFinite(v)).toBe(true);
        if (at >= ms || ms <= 0) { expect(v).toBe(to); expect(done).toBe(1); t.count('ended'); continue; }
        expect(done).toBe(0);
        const share = at / ms;
        expect(Math.abs(v - (from + (to - from) * share))).toBeLessThanOrEqual(1e-6 * Math.max(1, Math.abs(to - from)));
        if (ms < 1) t.count('sub-ms midway');
      }
      expect(done).toBeLessThanOrEqual(1);
    }), runs(RUNS));
    t.atLeast('ended', 50);
  }, timeoutFor(RUNS, 5));

  it('keeps every animation finite on frames anywhere on the clock, the largest jumps included', () => {
    fc.assert(fc.property(value, value, fc.integer({ min: 1, max: 800 }), fc.constantFrom(-Number.MAX_VALUE, -1e300, 0, 1e300), edgeTimes,
      (from, to, ms, origin, times) => {
        const h = clocked();
        h.at(origin);
        const seen: number[] = [];
        h.animator.tween({ from, to, ms, easing: 'linear', onTick: (v) => seen.push(v) });
        h.animator.spring({ from, to, onTick: (v) => seen.push(v) });
        const tl = h.animator.timeline({ tracks: [{ kind: 'sampled', keys: [{ t: 0, value: from }, { t: ms, value: to }], onTick: (v: number) => seen.push(v) }], loop: true });
        for (const at of times) {
          h.at(Math.min(Number.MAX_VALUE, at === 0 ? origin : origin + at));
          for (const v of seen) expect(Number.isFinite(v), `${v}`).toBe(true);
          expect(Number.isFinite(tl.time())).toBe(true);
          seen.length = 0;
        }
      }), runs(RUNS));
  }, timeoutFor(RUNS, 5));

  it('a spring at any finite constants stays finite and, given time, comes to rest on `to`', () => {
    const t = tally();
    const constant = fc.oneof(fc.double({ min: 1e-6, max: 1e6, noNaN: true }), fc.constantFrom(5e-324, 1e-300, 1e9, 1e300));
    fc.assert(fc.property(value, value, constant, constant, constant, (from, to, stiffness, damping, mass) => {
      const h = clocked();
      h.at(0);
      let last = from;
      let done = 0;
      h.animator.spring({ from, to, stiffness, damping, mass, onTick: (v) => { last = v; }, onDone: () => { done++; } });
      for (let now = 16; now < 1e7 && done === 0; now *= 1.5) {
        h.at(now);
        expect(Number.isFinite(last), `${last} at ${now}`).toBe(true);
      }
      if (done === 1) { expect(last).toBe(to); t.count('rested'); }
    }), runs(RUNS));
    t.atLeast('rested', 50);
  }, timeoutFor(RUNS, 20));

  it('keys and labels named like Object.prototype members are keys like any other', () => {
    const names = fc.constantFrom('__proto__', 'constructor', 'toString', 'hasOwnProperty', 'valueOf', '');
    fc.assert(fc.property(names, names, (a, b) => {
      const h = clocked();
      h.at(0);
      expect(h.animator.isActive(a)).toBe(false);
      h.animator.cancelKey(a);
      h.animator.tween({ from: 0, to: 1, ms: 100, cancelKey: a, label: b, onTick: () => {} });
      expect(h.animator.isActive(a)).toBe(true);
      expect(h.animator.isActive(b)).toBe(a === b);
      const row = h.animator.live()[0]!;
      expect(row.key).toBe(a);
      expect(row.label).toBe(b);
      expect(Object.getPrototypeOf(row)).toBe(Object.prototype);
      h.animator.setTimeScaleByKey(a, 2);
      expect(h.animator.live()[0]!.timeScale).toBe(2);
      h.animator.cancelKey(b);
      expect(h.animator.isActive(a)).toBe(a !== b);
    }), runs(RUNS));
  });
});
