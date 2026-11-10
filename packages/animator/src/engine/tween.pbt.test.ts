/**
 * Tweens, springs, staggers and loops on a real hosted animator, against what each promises as a
 * function of time: the value at a frame whatever frames came before, time scales composing,
 * play backward retracing play forward, and tweens on one target adding.
 */
import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import type { SpringPresetName } from '@weasel-js/geom';
import { createTarget } from '../target';
import { clocked, runs, tally, timeoutFor } from '../pbt.fixture';

const RUNS = 200;

/** Frame times, ascending whole ms from 1. */
const frameTimes = fc.array(fc.integer({ min: 1, max: 120 }), { minLength: 1, maxLength: 30 })
  .map((ds) => ds.reduce<number[]>((out, d) => [...out, (out.at(-1) ?? 0) + d], []));
const value = fc.integer({ min: -1000, max: 1000 });
const duration = fc.integer({ min: 1, max: 800 });

const lerp = (a: number, b: number, u: number): number => a + (b - a) * Math.min(1, Math.max(0, u));

describe('animator.tween, property', () => {
  it('shows at each frame the value its elapsed time gives, and ends exactly at `to`', () => {
    const t = tally();
    fc.assert(fc.property(value, value, duration, frameTimes, (from, to, ms, times) => {
      const h = clocked();
      const seen: number[] = [];
      let done = 0;
      h.animator.tween({ from, to, ms, easing: 'linear', onTick: (v) => seen.push(v), onDone: () => { done++; } });
      for (const at of times) {
        const before = seen.length;
        h.at(at);
        if (seen.length === before) continue;
        if (at >= ms) expect(seen.at(-1)).toBe(to);
        else { expect(seen.at(-1)).toBeCloseTo(lerp(from, to, at / ms), 6); t.count('midway'); }
      }
      h.at(times.at(-1)! + ms);
      expect(seen.at(-1)).toBe(to);
      expect(done).toBe(1);
    }), runs(RUNS));
    t.atLeast('midway', 50);
  }, timeoutFor(RUNS, 5));

  it('runs at the product of its own and the animator time scale', () => {
    const scale = fc.constantFrom(0.25, 0.5, 1, 2, 4);
    fc.assert(fc.property(value, value, duration, scale, scale, frameTimes, (from, to, ms, own, global, times) => {
      const h = clocked();
      let last = Number.NaN;
      const handle = h.animator.tween({ from, to, ms, easing: 'linear', onTick: (v) => { last = v; } });
      handle.setTimeScale(own);
      h.animator.setTimeScale(global);
      expect(handle.timeScale()).toBe(own);
      for (const at of times) {
        h.at(at);
        expect(last).toBeCloseTo(lerp(from, to, (at * own * global) / ms), 6);
      }
    }), runs(RUNS));
  }, timeoutFor(RUNS, 5));

  it('retraces its values played backward on a followed clock', () => {
    const t = tally();
    fc.assert(fc.property(value, value, fc.integer({ min: 50, max: 800 }), fc.array(fc.integer({ min: -100, max: 100 }), { minLength: 1, maxLength: 30 }),
      (from, to, ms, moves) => {
        const h = clocked();
        let last = Number.NaN;
        h.animator.tween({ from, to, ms, easing: 'linear', onTick: (v) => { last = v; } });
        h.follow(0, 1);
        // Kept short of either end: a run that reaches its end or its start is over.
        let clock = 0;
        for (const d of moves) {
          if (clock + d <= 0 || clock + d >= ms || d === 0) continue;
          clock += d;
          h.follow(clock, Math.sign(d));
          expect(last).toBeCloseTo(lerp(from, to, clock / ms), 6);
          if (d < 0) t.count('backward');
        }
      }), runs(RUNS));
    t.atLeast('backward', 30);
  }, timeoutFor(RUNS, 5));
});

interface Start { at: number; to: number; ms: number }

describe('tweens on one target, property', () => {
  it('add: what shows is the committed value plus what each has left to travel', () => {
    const t = tally();
    const starts = fc.array(fc.record({ at: fc.integer({ min: 0, max: 600 }), to: value, ms: duration }), { minLength: 1, maxLength: 5 })
      .map((ss) => ss.sort((a, b) => a.at - b.at));
    fc.assert(fc.property(value, starts, fc.integer({ min: 1, max: 60 }), (initial, ss, step) => {
      const h = clocked();
      let committed = initial;
      const target = createTarget<number>({ get: () => committed, set: (v) => { committed = v; } });
      const live: (Start & { from: number })[] = [];
      let model = initial;
      let next = 0;
      const end = ss.at(-1)!.at + Math.max(...ss.map((s) => s.ms)) + step;
      for (let now = 0; now <= end; now += step) {
        while (next < ss.length && ss[next]!.at <= now) {
          const s = ss[next++]!;
          h.at(s.at);
          live.push({ ...s, from: model });
          model = s.to;
          h.animator.tween({ target, to: s.to, ms: s.ms, easing: 'linear' });
          expect(committed).toBe(s.to);
        }
        h.at(now);
        const left = live.reduce((sum, s) => sum + (s.from - s.to) * (1 - Math.min(1, (now - s.at) / s.ms)), 0);
        expect(target.read()).toBeCloseTo(model + left, 6);
        if (live.filter((s) => now - s.at < s.ms).length > 1) t.count('overlapping');
      }
      expect(target.active).toBe(false);
      expect(target.read()).toBe(ss.at(-1)!.to);
    }), { ...runs(RUNS) });
    t.atLeast('overlapping', 30);
  }, timeoutFor(RUNS, 30));

  it('stop leaves what shows where it was, and commits it', () => {
    fc.assert(fc.property(value, value, value, duration, duration, fc.integer({ min: 0, max: 900 }), (initial, a, b, msA, msB, when) => {
      const h = clocked();
      let committed = initial;
      const target = createTarget<number>({ get: () => committed, set: (v) => { committed = v; } });
      h.at(0);
      h.animator.tween({ target, to: a, ms: msA, easing: 'linear' });
      h.at(when >> 1);
      h.animator.tween({ target, to: b, ms: msB, easing: 'easeInOutQuad' });
      h.at(when);
      const shown = target.read();
      target.stop();
      expect(target.active).toBe(false);
      expect(target.read()).toBeCloseTo(shown, 9);
      expect(committed).toBeCloseTo(shown, 9);
      h.at(when + 1000);
      expect(target.read()).toBeCloseTo(shown, 9);
    }), runs(RUNS));
  }, timeoutFor(RUNS, 5));
});

describe('animator.spring on a target, property', () => {
  it('comes to rest exactly on `to`', () => {
    fc.assert(fc.property(value, value, fc.constantFrom<SpringPresetName | undefined>(undefined, 'gentle', 'wobbly', 'stiff', 'slow'), fc.integer({ min: 4, max: 40 }),
      (initial, to, preset, step) => {
        const h = clocked();
        let committed = initial;
        const target = createTarget<number>({ get: () => committed, set: (v) => { committed = v; } });
        let done = 0;
        h.animator.spring({ target, to, preset, onDone: () => { done++; } });
        for (let now = 0; now < 60_000 && target.active; now += step) {
          h.at(now);
          expect(Number.isFinite(target.read())).toBe(true);
        }
        expect(target.active).toBe(false);
        expect(done).toBe(1);
        expect(target.read()).toBe(to);
      }), runs(RUNS));
  }, timeoutFor(RUNS, 30));
});

describe('animator.stagger, property', () => {
  it('starts each item once, on the first frame at or past its delay, and finishes after the last', () => {
    const t = tally();
    fc.assert(fc.property(
      fc.array(fc.integer({ min: -50, max: 500 }), { maxLength: 8 }),
      fc.integer({ min: 1, max: 80 }), duration,
      (delays, step, ms) => {
        const h = clocked();
        const started: { i: number; at: number }[] = [];
        let finished = 0;
        let now = 0;
        h.at(0);
        h.animator.stagger(delays, (i) => delays[i]!, (_d, i) => {
          started.push({ i, at: now });
          return h.animator.tween({ from: 0, to: 1, ms, onTick: () => {}, onDone: () => { finished++; } });
        }, { cancelKey: 'wave' });
        while (now < 2000 && finished < delays.length) {
          now += step;
          h.at(now);
        }
        expect(started.map((s) => s.i).sort((a, b) => a - b)).toEqual(delays.map((_, i) => i));
        for (const s of started) {
          const d = delays[s.i]!;
          if (d <= 0) expect(s.at).toBe(0);
          else {
            expect(s.at).toBeGreaterThanOrEqual(d);
            expect(s.at - step).toBeLessThan(d);
          }
        }
        const order = [...started].sort((a, b) => a.at - b.at || 0);
        for (let k = 1; k < order.length; k++) expect(Math.max(0, delays[order[k - 1]!.i]!)).toBeLessThanOrEqual(Math.max(0, delays[order[k]!.i]!) + step);
        h.at(now + ms + step);
        expect(h.animator.isActive('wave')).toBe(false);
        if (delays.filter((d) => d > 0).length > 1) t.count('waited');
      }), runs(RUNS));
    t.atLeast('waited', 30);
  }, timeoutFor(RUNS, 5));
});

describe('animator.tweenLoop, property', () => {
  it('runs `count` passes and ends where its direction puts the last', () => {
    fc.assert(fc.property(value, value, fc.integer({ min: 1, max: 5 }), fc.constantFrom<'restart' | 'reverse' | 'alternate'>('restart', 'reverse', 'alternate'),
      fc.integer({ min: 10, max: 200 }), fc.integer({ min: 1, max: 60 }),
      (from, to, count, direction, ms, step) => {
        const h = clocked();
        let last = Number.NaN;
        let done = 0;
        h.animator.tweenLoop({ from, to, ms, count, direction, easing: 'linear', onTick: (v) => { last = v; }, onDone: () => { done++; } });
        let now = 0;
        for (; now < count * ms * 2 + 1000 && done === 0; now += step) h.at(now);
        expect(done).toBe(1);
        const flipped = direction === 'reverse' || (direction === 'alternate' && (count - 1) % 2 === 1);
        expect(last).toBe(flipped ? from : to);
      }), runs(RUNS));
  }, timeoutFor(RUNS, 5));
});
