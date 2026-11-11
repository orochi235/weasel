/**
 * Moods: a cue reading's weights are a distribution peaking at the cue it names, a mood out of range reads as its
 * nearest end, and each score parameter follows its one axis, monotonically.
 */
import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { readScoreCue, scoreCues, scoreParams, type ScoreMood } from './scoreMood';
import { anyFinite, runs, tally, timeoutFor } from './pbt.fixture';

const RUNS = 400;
const unit = fc.double({ min: 0, max: 1, noNaN: true });
const inRangeMood: fc.Arbitrary<ScoreMood> = fc.record({ valence: fc.double({ min: -1, max: 1, noNaN: true }), tension: unit, urgency: unit });
const anyMood: fc.Arbitrary<ScoreMood> = fc.oneof(
  inRangeMood,
  fc.record({ valence: anyFinite, tension: anyFinite, urgency: anyFinite }),
  fc.constantFrom(...scoreCues.map((c) => c.mood)),
  // A hair from a cue, where an inverse squared distance can overflow.
  fc.tuple(fc.constantFrom(...scoreCues.map((c) => c.mood)), fc.constantFrom('valence', 'tension', 'urgency'), fc.double({ min: 1e-200, max: 1e-140, noNaN: true }))
    .map(([m, axis, d]) => ({ ...m, [axis]: m[axis] + (m[axis] > 0 ? -d : d) })),
);
const clamp = (v: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, v));
const clamped = (m: ScoreMood): ScoreMood => ({ valence: clamp(m.valence, -1, 1), tension: clamp(m.tension, 0, 1), urgency: clamp(m.urgency, 0, 1) });

const BY_AXIS = {
  valence: ['mode', 'register', 'spread'],
  tension: ['harmony', 'layers'],
  urgency: ['tempo', 'density', 'articulation', 'harmonicRhythm', 'attack'],
} as const;
const BRIGHTNESS = ['phrygian', 'aeolian', 'dorian', 'ionian', 'lydian'];
const HARMONY = ['triadic', 'quartal', 'cluster'];

describe('readScoreCue', () => {
  it('weighs every cue in 0..1, summing to 1, names the heaviest, and reads a mood out of range as its nearest end', () => {
    const seen = tally();
    fc.assert(fc.property(anyMood, (mood) => {
      const r = readScoreCue(mood);
      const ws = Object.values(r.weights);
      expect(ws).toHaveLength(scoreCues.length);
      for (const w of ws) {
        expect(Number.isFinite(w)).toBe(true);
        expect(w).toBeGreaterThanOrEqual(0);
        expect(w).toBeLessThanOrEqual(1);
      }
      expect(ws.reduce((a, b) => a + b, 0)).toBeCloseTo(1, 12);
      expect(r.weights[r.name]).toBe(Math.max(...ws));
      expect(readScoreCue(clamped(mood))).toEqual(r);
      const cue = scoreCues.find((c) => c.mood.valence === mood.valence && c.mood.tension === mood.tension && c.mood.urgency === mood.urgency);
      if (cue) {
        expect(r.name).toBe(cue.name);
        expect(r.weights[cue.name]).toBe(1);
        seen.count('at a cue');
      }
    }), runs(RUNS));
    seen.atLeast('at a cue', RUNS / 20);
  }, timeoutFor(RUNS, 1));
});

describe('scoreParams', () => {
  it('takes each parameter from its one axis, monotonically, and reads a mood out of range as its nearest end', () => {
    fc.assert(fc.property(inRangeMood, inRangeMood, fc.constantFrom('valence', 'tension', 'urgency'), (a, b, axis) => {
      // `b` differs from `a` on `axis` alone, and lies above it there.
      const lo = { ...a, [axis]: Math.min(a[axis], b[axis]) };
      const hi = { ...a, [axis]: Math.max(a[axis], b[axis]) };
      const [p, q] = [scoreParams(lo), scoreParams(hi)];
      for (const [other, keys] of Object.entries(BY_AXIS)) {
        if (other === axis) continue;
        for (const k of keys) expect(q[k], k).toEqual(p[k]);
      }
      if (axis === 'valence') {
        expect(BRIGHTNESS.indexOf(q.mode)).toBeGreaterThanOrEqual(BRIGHTNESS.indexOf(p.mode));
        expect(q.register).toBeGreaterThanOrEqual(p.register);
        expect(q.spread).toBeGreaterThanOrEqual(p.spread);
      } else if (axis === 'tension') {
        expect(HARMONY.indexOf(q.harmony)).toBeGreaterThanOrEqual(HARMONY.indexOf(p.harmony));
        expect(q.layers).toBeGreaterThanOrEqual(p.layers);
      } else {
        expect(q.tempo).toBeGreaterThanOrEqual(p.tempo);
        expect(q.density).toBeGreaterThanOrEqual(p.density);
        expect(q.harmonicRhythm).toBeLessThanOrEqual(p.harmonicRhythm);
        expect(q.attack).toBeLessThanOrEqual(p.attack);
      }
      expect(p.spread).toBeGreaterThanOrEqual(1);
      expect(p.spread).toBeLessThanOrEqual(3);
      expect(p.tempo).toBeGreaterThan(0);
    }), runs(RUNS));
    fc.assert(fc.property(anyMood, (m) => { expect(scoreParams(m)).toEqual(scoreParams(clamped(m))); }), runs(RUNS));
  }, timeoutFor(RUNS, 2));
});
