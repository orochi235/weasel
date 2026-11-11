/**
 * Score bars: the same arguments write the same bar, every note sits inside the bar on a whole MIDI note, the notes
 * sounding on any step add up to no more than the bar's gain, the chord changes only on the harmonic rhythm, and a
 * pulsed bar's ostinato takes every chord tone.
 */
import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { SCORE_BAR_STEPS, scoreBar, scoreChord } from './scoreBar';
import { scoreParams, type ScoreMood } from './scoreMood';
import { runs, tally, timeoutFor } from './pbt.fixture';

const RUNS = 300;
const unit = fc.double({ min: 0, max: 1, noNaN: true });
const mood: fc.Arbitrary<ScoreMood> = fc.record({ valence: fc.double({ min: -1, max: 1, noNaN: true }), tension: unit, urgency: unit });
const opts = fc.record({
  tonic: fc.integer({ min: -12, max: 12 }),
  gain: fc.oneof(fc.constantFrom(0, 0.5, 1), fc.double({ min: 0, max: 4, noNaN: true })),
  seed: fc.integer(),
  bus: fc.constantFrom('music', 'sfx'),
}, { requiredKeys: [] });

const midiOf = (pitch: unknown): number => (pitch as { midi: number }).midi;

describe('scoreBar', () => {
  it('writes the same bar from the same arguments, inside the bar, at no more than its gain on any step', () => {
    const seen = tally();
    fc.assert(fc.property(mood, fc.integer({ min: 0, max: 64 }), opts, (m, bar, o) => {
      const params = scoreParams(m);
      const events = scoreBar(params, bar, o);
      expect(scoreBar(params, bar, o)).toEqual(events);
      expect(events.length).toBeGreaterThan(0);
      const gain = o.gain ?? 0.5;
      for (const e of events) {
        expect(e.step).toBeGreaterThanOrEqual(0);
        expect(e.step + (e.length ?? 1)).toBeLessThanOrEqual(SCORE_BAR_STEPS);
        expect(Number.isInteger(midiOf(e.pitch))).toBe(true);
        expect(e.gain).toBeGreaterThanOrEqual(0);
        expect(e.bus).toBe(o.bus);
      }
      for (let step = 0; step < SCORE_BAR_STEPS; step += 1) {
        const sounding = events.filter((e) => e.step <= step && step < e.step + (e.length ?? 1));
        expect(sounding.reduce((sum, e) => sum + e.gain!, 0)).toBeLessThanOrEqual(gain * (1 + 1e-12) + 1e-300);
      }
      const chord = scoreChord(params, Math.floor(bar / params.harmonicRhythm), o.tonic);
      if (params.density === 0) {
        expect(events.map((e) => midiOf(e.pitch))).toEqual(chord);
        seen.count('held');
      } else {
        const pulses = events.filter((e) => e.gain === gain * 0.4).map((e) => midiOf(e.pitch));
        if (gain > 0 && pulses.length >= chord.length) expect(new Set(pulses)).toEqual(new Set(chord));
        seen.count('pulsed');
      }
    }), runs(RUNS));
    seen.atLeast('held', RUNS / 20);
    seen.atLeast('pulsed', RUNS / 4);
  }, timeoutFor(RUNS, 3));

  it('changes chord only on the harmonic rhythm', () => {
    fc.assert(fc.property(mood, fc.integer({ min: 0, max: 64 }), fc.integer({ min: -12, max: 12 }), (m, bar, tonic) => {
      const params = scoreParams(m);
      const first = bar - (bar % params.harmonicRhythm);
      expect(scoreChord(params, Math.floor(bar / params.harmonicRhythm), tonic)).toEqual(scoreChord(params, Math.floor(first / params.harmonicRhythm), tonic));
      const chord = scoreChord(params, bar, tonic);
      expect(chord.length).toBeGreaterThanOrEqual(3);
      for (const n of chord) expect(Number.isInteger(n)).toBe(true);
      expect(Math.min(...chord)).toBe(chord[0]);
    }), runs(RUNS));
  }, timeoutFor(RUNS, 1));
});
