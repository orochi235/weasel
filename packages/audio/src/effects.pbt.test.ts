/**
 * Properties of the delay and reverb inserts over options and setter calls of any value: an effect is made or
 * refused with the package's own RangeError, and a delay line it makes is one a `DelayNode` takes (longer than 0
 * and shorter than 180 s); a refused setter changes nothing it reports, and an accepted one reports what was set.
 */
import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { createDelayEffect, createReverbEffect } from './effects';
import { delayNode } from './graph/processors';
import { createFakeAudioContext } from './testing/fakeAudioContext';
import { anyFinite, runs, tally } from './pbt.fixture';

const seen = tally();
/** What a `DelayNode`'s longest time must be below, ms. */
const MOST_DELAY_MS = 180_000;

const ms = fc.oneof(
  { weight: 4, arbitrary: fc.double({ min: 0, max: 3000, noNaN: true }) },
  { weight: 1, arbitrary: anyFinite },
  { weight: 1, arbitrary: fc.constantFrom(NaN, Infinity, 0, 179_999, 180_000, 180_001, 5e-324, undefined) },
);
const unit = fc.oneof(fc.double({ min: -1.5, max: 1.5, noNaN: true }), fc.constantFrom(NaN, -1, 1, 0, undefined));
const ramp = fc.oneof(fc.constant(undefined), fc.double({ min: 0, max: 100, noNaN: true }), fc.constantFrom(NaN, Infinity));

function refusedOurs(f: () => void): boolean {
  try { f(); } catch (e) {
    expect(e).toBeInstanceOf(RangeError);
    expect((e as Error).message).toMatch(/^@weasel-js\/audio: /);
    return true;
  }
  return false;
}

describe('the delay insert', () => {
  it('makes a line a DelayNode takes or refuses its options itself, and setters change only what they accept', () => {
    const setter = fc.record({ which: fc.constantFrom('time' as const, 'feedback' as const, 'mix' as const), value: fc.oneof(ms, unit), ramp });
    fc.assert(fc.property(ms, ms, unit, unit, fc.boolean(), fc.array(setter, { maxLength: 8 }), (time, maxTime, feedback, mix, asNode, calls) => {
      const ctx = createFakeAudioContext();
      const made: number[] = [];
      const createDelay = ctx.createDelay;
      ctx.createDelay = (s?: number) => { made.push(s!); return createDelay(s); };
      const opts = {
        ...(time !== undefined ? { time } : {}), ...(maxTime !== undefined ? { maxTime } : {}),
        ...(feedback !== undefined ? { feedback } : {}), ...(mix !== undefined ? { mix } : {}),
      };
      let fx: ReturnType<typeof createDelayEffect> | null = null;
      const refused = refusedOurs(() => {
        if (asNode) delayNode(ctx as never, opts);
        else fx = createDelayEffect(ctx as never, opts);
      });
      for (const s of made) {
        expect(s).toBeGreaterThan(0);
        expect(s * 1000).toBeLessThan(MOST_DELAY_MS);
      }
      seen.count(refused ? 'refused' : 'made');
      if (refused || !fx) return;
      const effect: ReturnType<typeof createDelayEffect> = fx;
      for (const c of calls) {
        const before = { fb: effect.feedback(), mix: effect.mix() };
        const v = c.value ?? 0;
        const no = refusedOurs(() => {
          if (c.which === 'time') effect.setTime(v, c.ramp);
          else if (c.which === 'feedback') effect.setFeedback(v, c.ramp);
          else effect.setMix(v, c.ramp);
        });
        if (no || c.which !== 'feedback') expect(effect.feedback()).toBe(before.fb);
        else expect(effect.feedback()).toBe(v);
        if (no || c.which !== 'mix') expect(effect.mix()).toBe(before.mix);
        else expect(effect.mix()).toBe(v);
        seen.count(no ? 'set refused' : 'set');
      }
    }), runs(500));
    for (const k of ['made', 'refused', 'set', 'set refused']) seen.atLeast(k, 30);
  });
});

describe('the reverb insert', () => {
  it('refuses a mix outside 0..1 itself and keeps the last mix it accepted', () => {
    fc.assert(fc.property(unit, fc.array(fc.tuple(unit, ramp), { maxLength: 6 }), (mix, calls) => {
      const ctx = createFakeAudioContext();
      const impulse = ctx.createBuffer(2, 64, 48000) as never;
      let fx: ReturnType<typeof createReverbEffect> | null = null;
      if (refusedOurs(() => { fx = createReverbEffect(ctx as never, { impulse, ...(mix !== undefined ? { mix } : {}) }); })) return;
      const effect: ReturnType<typeof createReverbEffect> = fx!;
      for (const [v, r] of calls) {
        const before = effect.mix();
        const value = v ?? 0;
        const no = refusedOurs(() => effect.setMix(value, r));
        expect(effect.mix()).toBe(no ? before : value);
      }
    }), runs(300));
  });
});
