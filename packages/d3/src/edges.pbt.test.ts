/**
 * Property tests of transitions at the edges of their timing: durations and delays that are zero, negative, NaN,
 * infinite, or past what one timer can wait. A NaN duration is refused where it is set; any other transition starts
 * no sooner than its delay, ends at its target once its delay and duration have run, holds where it started for as
 * long as either is infinite, settles when interrupted, and writes only finite poses.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import fc from 'fast-check';
import { asNodeId } from '@weasel-js/core';
import { d3Bind } from './bind';
import { makeAnimator, makeScene, runs, tally, timeoutFor } from './pbt.fixture';

const RUNS = 150;
const LONGEST_TIMER = 2 ** 31 - 1;

beforeEach(() => { vi.useFakeTimers(); });
afterEach(() => { vi.useRealTimers(); });

const box = (x: number) => ({ x, y: 0, width: 1, height: 1 });
const duration = fc.oneof(fc.integer({ min: 0, max: 1000 }), fc.constantFrom(-5, -Infinity, Infinity, NaN, 1e12, 0.5));
const delay = fc.oneof(fc.integer({ min: 0, max: 1000 }), fc.constantFrom(-5, NaN, Infinity, LONGEST_TIMER, LONGEST_TIMER + 1, 3e9, 1e13));

describe('a transition at any duration and delay', () => {
  it('waits out its delay, ends at its target after its duration, or is refused for a NaN duration', async () => {
    const seen = tally();
    await fc.assert(fc.asyncProperty(duration, delay, fc.boolean(), async (ms, wait, perItem) => {
      const scene = makeScene();
      const clock = makeAnimator();
      const poses: number[] = [];
      const unsub = scene.subscribe(() => { const x = scene.get(asNodeId('a'))?.pose.x; if (x !== undefined) poses.push(x); });
      const advance = (step: number) => { vi.advanceTimersByTime(step); clock.advance(step); };
      d3Bind(scene, [{ id: 'a' }], { key: (d) => d.id }).pose(() => box(0)).join();
      const t = d3Bind(scene, [{ id: 'a' }], { key: (d) => d.id, animator: clock.animator }).pose(() => box(10)).join().transition();
      if (Number.isNaN(ms)) {
        seen.count('refused');
        expect(() => t.duration(ms)).toThrow(RangeError);
        clock.dispose();
        unsub();
        return;
      }
      t.duration(ms).delay(perItem ? () => wait : wait);
      let settled = false;
      void t.end().then(() => { settled = true; });
      const x = () => scene.get(asNodeId('a'))!.pose.x;
      const waits = Number.isFinite(wait) && wait > 0 ? wait : 0;
      const runsFor = ms === Infinity ? Infinity : Math.max(ms, 0);
      if (waits > 32) {
        advance(waits - 16);
        expect(x()).toBe(0);
        seen.count('waited');
      }
      const finite = Number.isFinite(waits + runsFor) && wait !== Infinity;
      advance(finite ? waits + runsFor + 16 : 1e14);
      advance(16);
      advance(16);
      await Promise.resolve();
      if (finite) {
        seen.count(waits > LONGEST_TIMER ? 'past one timer' : 'ended');
        expect(x()).toBe(10);
        expect(settled).toBe(true);
      } else {
        seen.count('held');
        expect(x()).toBe(0);
        expect(settled).toBe(false);
        t.interrupt();
        await Promise.resolve();
        expect(settled).toBe(true);
      }
      expect(poses.filter((p) => !Number.isFinite(p))).toEqual([]);
      clock.dispose();
      unsub();
    }), runs(RUNS));
    for (const what of ['refused', 'waited', 'past one timer', 'ended', 'held']) seen.atLeast(what, RUNS / 30);
  }, timeoutFor(RUNS, 20));
});
