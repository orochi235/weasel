/**
 * Property tests of transitions: whatever the poses, durations, eases, delays, and frame steps, a transition, and
 * each transition chained after it, leaves every node at exactly its target pose and a custom tween at exactly its
 * `to`; `start` and `end` fire once each, the end promise settles, and no tick writes a non-finite pose. An
 * interrupted chain leaves the nodes where it stopped and settles as interrupted.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import fc from 'fast-check';
import { asNodeId } from '@weasel-js/core';
import { d3Bind } from './bind';
import { makeAnimator, makeScene, num, pose, runs, tally, timeoutFor, type Pose } from './pbt.fixture';

const RUNS = 150;

beforeEach(() => { vi.useFakeTimers(); });
afterEach(() => { vi.useRealTimers(); });

const eases: Record<string, (t: number) => number> = {
  linear: (t) => t,
  quad: (t) => t * t,
  cubicInOut: (t) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2),
  sine: (t) => 1 - Math.cos((t * Math.PI) / 2),
};
const easeName = fc.constantFrom(...Object.keys(eases));

interface Datum { id: string; from: Pose; to: Pose; next: Pose; v0: number; v1: number; delay: number }
const datum = fc.record({
  id: fc.constantFrom('a', 'b', 'c', 'd', '__proto__'),
  from: pose, to: pose, next: pose, v0: num, v1: num,
  delay: fc.oneof(fc.constant(0), fc.integer({ min: 0, max: 400 })),
});

const finitePose = (p: Pose) => [p.x, p.y, p.width, p.height].every(Number.isFinite);

describe('d3 transitions', () => {
  it('end every node at exactly its target, through a chain, at any steps', async () => {
    const seen = tally();
    await fc.assert(fc.asyncProperty(
      fc.uniqueArray(datum, { selector: (d) => d.id, minLength: 1, maxLength: 4 }),
      fc.integer({ min: 0, max: 1500 }), easeName, fc.boolean(), fc.boolean(), fc.boolean(),
      fc.array(fc.integer({ min: 1, max: 300 }), { minLength: 1, maxLength: 12 }),
      async (data, ms, ease, enterFrom, chained, delayed, steps) => {
        const scene = makeScene();
        const clock = makeAnimator();
        const tweened = new Map<string, number>();
        const bad: Pose[] = [];
        const unsub = scene.subscribe?.(() => {
          for (const n of scene.nodesOnLayer('graph')) if (!finitePose(n.pose)) bad.push(n.pose);
        });
        if (!enterFrom) d3Bind(scene, data, { key: (d) => d.id }).pose((d) => d.from).join();
        const b = d3Bind(scene, data, { key: (d) => d.id, animator: clock.animator }).pose((d) => d.to);
        if (enterFrom) b.enterFrom((d) => d.from);
        let started = 0;
        let ended = 0;
        let interrupted = 0;
        const t = b.join().transition().duration(ms).ease(eases[ease]!)
          .tween({ name: 'v', from: (d) => d.v0, to: (d) => d.v1, apply: (d, _id, v) => { tweened.set(d.id, v as number); } })
          .on('start', () => { started++; }).on('end', () => { ended++; }).on('interrupt', () => { interrupted++; });
        if (delayed) t.delay((d) => d.delay);
        let last = t;
        if (chained) last = t.transition().pose((d) => d.next);
        let settled = false;
        void last.end().then(() => { settled = true; });
        const total = ms * (chained ? 2 : 1) + (delayed ? 400 * (chained ? 2 : 1) : 0) + 2;
        let elapsed = 0;
        let i = 0;
        // Frames at the steps given, then 16 ms ones until the chain is over, which a step overshooting an end
        // puts off: the next transition starts at the frame that ended the last.
        const cap = total + steps.reduce((x, y) => x + y, 0) + 1000;
        while (!settled && elapsed <= cap) {
          const step = steps[i++] ?? 16;
          elapsed += step;
          vi.advanceTimersByTime(step);
          clock.advance(step);
          await Promise.resolve();
        }
        for (let k = 0; k < 5; k++) await Promise.resolve();
        seen.count(chained ? 'chained' : 'single');
        if (ms === 0) seen.count('instant');
        for (const d of data) {
          expect(scene.get(asNodeId(d.id))!.pose).toEqual(chained ? d.next : d.to);
          expect(tweened.get(d.id)).toBe(d.v1);
        }
        expect(started).toBe(1);
        expect(ended).toBe(1);
        expect(interrupted).toBe(0);
        expect(settled).toBe(true);
        expect(bad).toEqual([]);
        unsub?.();
        clock.dispose();
      }), runs(RUNS));
    seen.atLeast('chained', RUNS / 4);
    seen.atLeast('single', RUNS / 4);
  }, timeoutFor(RUNS, 60));

  it('leave an interrupted chain where it stopped, settled as interrupted', async () => {
    const seen = tally();
    await fc.assert(fc.asyncProperty(
      fc.uniqueArray(datum, { selector: (d) => d.id, minLength: 1, maxLength: 4 }),
      fc.integer({ min: 50, max: 1500 }), fc.integer({ min: 0, max: 2000 }), easeName,
      async (data, ms, stopAt, ease) => {
        const scene = makeScene();
        const clock = makeAnimator();
        d3Bind(scene, data, { key: (d) => d.id }).pose((d) => d.from).join();
        let ended = 0;
        let interrupted = 0;
        const t = d3Bind(scene, data, { key: (d) => d.id, animator: clock.animator }).pose((d) => d.to)
          .join().transition().duration(ms).ease(eases[ease]!)
          .on('end', () => { ended++; }).on('interrupt', () => { interrupted++; });
        let settled = false;
        void t.end().then(() => { settled = true; });
        let elapsed = 0;
        while (elapsed < stopAt) { clock.advance(16); elapsed += 16; }
        const done = elapsed >= ms;
        t.interrupt();
        const held = data.map((d) => scene.get(asNodeId(d.id))!.pose);
        for (let k = 0; k < 10; k++) clock.advance(100);
        await Promise.resolve();
        await Promise.resolve();
        seen.count(done ? 'finished first' : 'cut short');
        expect(data.map((d) => scene.get(asNodeId(d.id))!.pose)).toEqual(held);
        expect(settled).toBe(true);
        if (done) { expect(ended).toBe(1); expect(interrupted).toBe(0); } else { expect(ended).toBe(0); expect(interrupted).toBe(1); }
        clock.dispose();
      }), runs(RUNS));
    seen.atLeast('cut short', RUNS / 4);
    seen.atLeast('finished first', RUNS / 10);
  }, timeoutFor(RUNS, 30));
});
