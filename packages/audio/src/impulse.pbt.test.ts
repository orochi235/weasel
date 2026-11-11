/**
 * Properties of `impulseResponse` over any length, decay, channel count, seed, and sample rate: it either refuses
 * the call with a RangeError or makes a buffer of the asked shape whose every sample is finite and inside the
 * decay's envelope; the same call makes the same buffer, and the channels differ.
 */
import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { impulseResponse } from './impulse';
import { createFakeAudioContext } from './testing/fakeAudioContext';
import { anyFinite, runs, tally, timeoutFor } from './pbt.fixture';

const seen = tally();
const FLOAT32_MAX = 3.4028234663852886e38;

const seconds = fc.oneof(
  { weight: 6, arbitrary: fc.double({ min: 0, max: 0.02, noNaN: true }) },
  { weight: 1, arbitrary: fc.constantFrom(5e-324, 1e-9, 0, -0, -1, NaN, Infinity, -Infinity) },
);
const decayDb = fc.oneof(
  { weight: 2, arbitrary: fc.double({ min: -100, max: 200, noNaN: true }) },
  { weight: 2, arbitrary: anyFinite },
  { weight: 1, arbitrary: fc.constantFrom(NaN, Infinity, -Infinity, -770, -771, undefined) },
);
const channels = fc.oneof(
  { weight: 4, arbitrary: fc.integer({ min: 1, max: 3 }) },
  { weight: 1, arbitrary: fc.constantFrom(0, -1, 1.5, NaN, Infinity, undefined) },
);
const sampleRate = fc.constantFrom(3000, 8000, 22050, 44100, 48000, 96000, 768000);

describe('impulseResponse', () => {
  it('refuses with a RangeError or makes a finite buffer inside its decay envelope', () => {
    fc.assert(fc.property(seconds, decayDb, channels, fc.oneof(fc.integer(), anyFinite), sampleRate, (s, db, ch, seed, rate) => {
      const ctx = createFakeAudioContext();
      ctx.sampleRate = rate;
      const opts = { ...(db !== undefined ? { decayDb: db } : {}), ...(ch !== undefined ? { channels: ch } : {}), seed };
      let buffer: ReturnType<typeof impulseResponse> | null = null;
      try {
        buffer = impulseResponse(ctx as never, s, opts);
      } catch (e) {
        expect(e).toBeInstanceOf(RangeError);
        expect((e as Error).message).toMatch(/^@weasel-js\/audio: /);
        seen.count('refused');
        return;
      }
      const wantDb = db ?? 60;
      const wantCh = ch ?? 2;
      expect(Number.isFinite(s) && s > 0).toBe(true);
      expect(Number.isInteger(wantCh) && wantCh >= 1).toBe(true);
      expect(buffer.numberOfChannels).toBe(wantCh);
      expect(buffer.length).toBe(Math.max(1, Math.round(s * rate)));
      const k = ((wantDb / 20) * Math.LN10) / buffer.length;
      for (let c = 0; c < wantCh; c += 1) {
        const data = buffer.getChannelData(c);
        for (let i = 0; i < data.length; i += 1) {
          expect(Number.isFinite(data[i])).toBe(true);
          const env = Math.min(FLOAT32_MAX, Math.exp(-k * i));
          expect(Math.abs(data[i])).toBeLessThanOrEqual(env * (1 + 1e-6) + 1e-45);
        }
      }
      seen.count('made');
    }), runs(400));
    seen.atLeast('made', 100);
    seen.atLeast('refused', 20);
  }, timeoutFor(400, 3));

  it('makes the same buffer from the same call, with channels that differ', () => {
    fc.assert(fc.property(fc.double({ min: 0.001, max: 0.01, noNaN: true }), fc.integer(), (s, seed) => {
      const ctx = createFakeAudioContext();
      const a = impulseResponse(ctx as never, s, { seed, channels: 2 });
      const b = impulseResponse(ctx as never, s, { seed, channels: 2 });
      expect(b.getChannelData(0)).toEqual(a.getChannelData(0));
      expect(b.getChannelData(1)).toEqual(a.getChannelData(1));
      expect(a.getChannelData(1)).not.toEqual(a.getChannelData(0));
    }), runs(100));
  });
});
