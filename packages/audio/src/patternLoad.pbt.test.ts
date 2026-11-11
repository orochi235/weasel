/**
 * `patternVoicePeaks` against a brute-force count: the most spans on a bus holding a slot at any instant, a span
 * holding it from a lookahead before its step to the end of its sound, half-open so one ending frees its slot for
 * one starting, and copied across enough passes of a loop that every tail rings into a later one.
 */
import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { resolveEnvelope } from './envelope';
import { patternLength, type PatternEvent } from './patternPlayer';
import { patternVoicePeaks, type PatternLoadOptions } from './patternLoad';
import { runs, tally, timeoutFor } from './pbt.fixture';

const RUNS = 300;
const BUSES = ['sfx', 'music'] as const;
const HIT = { id: 'snd_1' };

const event: fc.Arbitrary<PatternEvent> = fc.oneof(
  fc.record({
    step: fc.oneof(fc.integer({ min: 0, max: 15 }), fc.double({ min: 0, max: 15.99, noNaN: true }), fc.integer({ min: 0, max: 3 })),
    pitch: fc.constant('C4'),
    length: fc.oneof(fc.integer({ min: 1, max: 8 }), fc.double({ min: 0.1, max: 4, noNaN: true })),
    envelope: fc.record({ release: fc.oneof(fc.integer({ min: 0, max: 400 }), fc.integer({ min: 0, max: 5000 })) }),
    bus: fc.constantFrom(...BUSES),
  }, { requiredKeys: ['step', 'pitch'] }),
  fc.record({ step: fc.integer({ min: 0, max: 15 }), noise: fc.constant('white' as const), bus: fc.constantFrom(...BUSES) }, { requiredKeys: ['step', 'noise'] }),
  fc.record({ step: fc.integer({ min: 0, max: 15 }), sound: fc.constant(HIT), bus: fc.constantFrom(...BUSES) }, { requiredKeys: ['step', 'sound'] }),
);
const options = fc.record({
  tempo: fc.oneof(fc.constantFrom(60, 120, 180), fc.integer({ min: 30, max: 300 })),
  stepsPerBeat: fc.constantFrom(1, 2, 4),
  length: fc.option(fc.oneof(fc.integer({ min: 1, max: 4 }), fc.integer({ min: 1, max: 32 })), { nil: undefined }),
  loop: fc.boolean(),
  bus: fc.option(fc.constantFrom(...BUSES), { nil: undefined }),
  lookahead: fc.oneof(fc.constant(100), fc.integer({ min: 1, max: 400 })),
  hit: fc.option(fc.integer({ min: 1, max: 2000 }), { nil: undefined }),
});

/** The most spans holding a slot at once on each bus, by counting at every span's start. */
function bruteForce(events: readonly PatternEvent[], o: PatternLoadOptions & { hit?: number }): Record<string, number> {
  const spb = o.stepsPerBeat ?? 4;
  const stepMs = 60_000 / o.tempo / spb;
  const lead = o.lookahead ?? 100;
  const pass = o.length ?? patternLength(events, spb);
  // The player books an event only on a step of the pass.
  const spans = events.filter((e) => e.step >= 0 && Math.floor(e.step) < pass).map((e) => {
    const sounds = 'sound' in e ? (o.hit ?? stepMs) : (e.length ?? 1) * stepMs + resolveEnvelope(e.envelope).release;
    return { bus: e.bus ?? o.bus ?? 'sfx', from: e.step * stepMs - lead, until: e.step * stepMs + sounds };
  });
  const passMs = pass * stepMs;
  const longest = Math.max(0, ...spans.map((s) => s.until - s.from));
  // More passes than any tail can reach across, so the steady state is met.
  const passes = o.loop === false ? 0 : Math.ceil(longest / passMs) + 2;
  const copies = spans.flatMap((s) => Array.from({ length: passes + 1 }, (_, p) => ({ ...s, from: s.from + p * passMs, until: s.until + p * passMs })));
  const peaks: Record<string, number> = {};
  for (const s of copies) {
    const held = copies.filter((c) => c.bus === s.bus && c.from <= s.from && s.from < c.until).length;
    peaks[s.bus] = Math.max(peaks[s.bus] ?? 0, held);
  }
  return peaks;
}

describe('patternVoicePeaks', () => {
  it('counts the most voices a bus holds at once, as a brute-force count does', () => {
    const seen = tally();
    fc.assert(fc.property(fc.array(event, { maxLength: 10 }), options, (events, o) => {
      const opts: PatternLoadOptions = {
        tempo: o.tempo, stepsPerBeat: o.stepsPerBeat, loop: o.loop, lookahead: o.lookahead,
        ...(o.length !== undefined ? { length: o.length } : {}),
        ...(o.bus !== undefined ? { bus: o.bus } : {}),
        ...(o.hit !== undefined ? { hitMs: () => o.hit! } : {}),
      };
      const got = patternVoicePeaks(events, opts);
      expect(got).toEqual(bruteForce(events, { ...opts, ...(o.hit !== undefined ? { hit: o.hit } : {}) }));
      if (Object.values(got).some((n) => n > 1)) seen.count('overlap');
      if (o.loop) {
        const once = patternVoicePeaks(events, { ...opts, loop: false });
        if (Object.entries(got).some(([bus, n]) => n > once[bus]!)) seen.count('tails wrap');
      }
    }), runs(RUNS));
    seen.atLeast('overlap', RUNS / 4);
    seen.atLeast('tails wrap', RUNS / 20);
  }, timeoutFor(RUNS, 5));

  it('never counts fewer voices for a pattern with an event added', () => {
    fc.assert(fc.property(fc.array(event, { maxLength: 8 }), event, options, (events, extra, o) => {
      // A fixed length, so the added event cannot stretch the pass and spread the rest out.
      const opts: PatternLoadOptions = { tempo: o.tempo, stepsPerBeat: o.stepsPerBeat, loop: o.loop, lookahead: o.lookahead, length: 64 };
      const before = patternVoicePeaks(events, opts);
      const after = patternVoicePeaks([...events, extra], opts);
      for (const [bus, n] of Object.entries(before)) expect(after[bus]).toBeGreaterThanOrEqual(n);
    }), runs(RUNS));
  }, timeoutFor(RUNS, 2));
});
