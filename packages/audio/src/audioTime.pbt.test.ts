/**
 * Stateful test of `atAudioTime` through clock advances of any length, timers fired late or early, the context
 * suspending, resuming, and closing, and cancels: the callback runs at most once, never on a running clock short
 * of its time, always by the first check that finds the clock there or not running, and never after a cancel.
 * Every delay it asks a timer for is one a timer takes: finite, at least 1 ms, and within a 32-bit count of ms.
 */
import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { atAudioTime } from './audioTime';
import { createFakeAudioContext } from './testing/fakeAudioContext';
import { runs, tally } from './pbt.fixture';

const seen = tally();
const MOST_MS = 2 ** 31 - 1;

const at = fc.oneof(
  { weight: 1, arbitrary: fc.double({ min: -1, max: 0, noNaN: true }) },
  { weight: 6, arbitrary: fc.double({ min: 0.001, max: 5, noNaN: true }) },
  { weight: 1, arbitrary: fc.constantFrom(0, 1e-7, 1e9, 1e300, Infinity, -Infinity, NaN) },
);
const cmd = fc.oneof(
  { weight: 4, arbitrary: fc.record({ kind: fc.constant('advance' as const), ms: fc.oneof(fc.double({ min: 0, max: 3000, noNaN: true }), fc.constantFrom(0, 1e-6, 1e12)) }) },
  { weight: 3, arbitrary: fc.constant({ kind: 'fire' as const }) },
  { weight: 1, arbitrary: fc.record({ kind: fc.constant('state' as const), to: fc.constantFrom('running' as const, 'suspended' as const, 'closed' as const) }) },
  { weight: 1, arbitrary: fc.constant({ kind: 'cancel' as const }) },
);

describe('atAudioTime', () => {
  it('runs its callback once, on the first check that finds the clock at its time or stopped, unless canceled', () => {
    fc.assert(fc.property(at, fc.constantFrom('running' as const, 'running' as const, 'suspended' as const), fc.array(cmd, { maxLength: 30 }), (when, state, cmds) => {
      const ctx = createFakeAudioContext();
      ctx.state = state;
      let pending: (() => void) | null = null;
      const delays: number[] = [];
      let calls = 0;
      let canceled = false;
      const due = (): boolean => ctx.state !== 'running' || !(when - ctx.currentTime > 1e-6);
      const cancel = atAudioTime(ctx as never, {
        setTimer: (cb, ms) => { expect(pending).toBeNull(); delays.push(ms); pending = cb; return 1; },
        clearTimer: () => { pending = null; },
      }, when, () => { calls += 1; });
      // The first check runs in the call.
      expect(calls).toBe(due() ? 1 : 0);
      for (const c of cmds) {
        const before = calls;
        if (c.kind === 'advance') ctx._advance(c.ms);
        else if (c.kind === 'state') ctx.state = c.to;
        else if (c.kind === 'cancel') { cancel(); canceled = true; expect(pending).toBeNull(); }
        else if (pending) {
          const f: () => void = pending;
          pending = null;
          const fire = !canceled && calls === 0 && due();
          f();
          expect(calls).toBe(before + (fire ? 1 : 0));
          if (!fire && calls === 0 && !canceled) expect(pending).not.toBeNull();
          seen.count(fire ? 'fired' : 'rearmed');
        }
        expect(calls).toBeLessThanOrEqual(1);
        if (canceled) expect(calls).toBe(before);
      }
      for (const ms of delays) {
        expect(Number.isFinite(ms)).toBe(true);
        expect(ms).toBeGreaterThanOrEqual(1);
        expect(ms).toBeLessThanOrEqual(MOST_MS);
      }
    }), runs(500));
    seen.atLeast('fired', 20);
    seen.atLeast('rearmed', 50);
  });
});
