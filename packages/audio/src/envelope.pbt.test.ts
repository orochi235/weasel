/**
 * ADSR envelopes: resolved values in range, levels finite and inside 0..1, rising through the attack and falling
 * after it, and `envelopePoints` tracing `envelopeLevel` exactly between its breakpoints, with or without a gate.
 */
import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { envelopeLevel, envelopePoints, resolveEnvelope, type Envelope, type EnvelopePoint, type ResolvedEnvelope } from './envelope';
import { anyFinite, ms, runs, tally, timeoutFor } from './pbt.fixture';

const RUNS = 400;

const envelope: fc.Arbitrary<Envelope> = fc.record({
  attack: ms, decay: ms, sustain: fc.oneof(fc.double({ min: 0, max: 1, noNaN: true }), fc.constantFrom(0, 1)), release: ms,
}, { requiredKeys: [] });
const resolved = envelope.map(resolveEnvelope);

/** A time to look at: a fraction of the way through the envelope's whole span, or one of its breakpoints. */
const sample = (e: ResolvedEnvelope, gate: number | undefined, u: number): number => {
  const span = (gate ?? e.attack + e.decay) + e.release;
  return u * (Number.isFinite(span) && span > 0 ? span * 1.25 : 10);
};

/** The level the ramps between `points` hold at `t`: both sides at a step, where two points share a time. */
function traced(points: readonly EnvelopePoint[], t: number): number[] {
  if (t <= points[0]!.at) return [points[0]!.value];
  const last = points[points.length - 1]!;
  if (t >= last.at) return points.filter((p) => p.at === t).map((p) => p.value).concat(last.value);
  const at = points.filter((p) => p.at === t).map((p) => p.value);
  if (at.length > 0) return at;
  const i = points.findIndex((p) => p.at > t) - 1;
  const [a, b] = [points[i]!, points[i + 1]!];
  return [a.value + ((b.value - a.value) * (t - a.at)) / (b.at - a.at)];
}

describe('resolveEnvelope', () => {
  it('keeps times at zero or more and the sustain inside 0..1, fills defaults, and is idempotent', () => {
    fc.assert(fc.property(fc.record({ attack: anyFinite, decay: anyFinite, sustain: anyFinite, release: anyFinite }, { requiredKeys: [] }), (env) => {
      const r = resolveEnvelope(env);
      for (const t of [r.attack, r.decay, r.release]) expect(t).toBeGreaterThanOrEqual(0);
      expect(r.sustain).toBeGreaterThanOrEqual(0);
      expect(r.sustain).toBeLessThanOrEqual(1);
      expect(resolveEnvelope(r)).toEqual(r);
      if (env.attack === undefined) expect(r.attack).toBe(5);
      if (env.release === undefined) expect(r.release).toBe(30);
    }), runs(RUNS));
  }, timeoutFor(RUNS, 2));
});

describe('envelopeLevel', () => {
  it('is finite and inside 0..1, rises through the attack, and never rises after it', () => {
    const seen = tally();
    fc.assert(fc.property(resolved, fc.option(ms, { nil: undefined }), fc.array(fc.double({ min: 0, max: 1, noNaN: true }), { minLength: 2, maxLength: 8 }), (e, gate, us) => {
      const ts = us.map((u) => sample(e, gate, u)).sort((a, b) => a - b);
      const levels = ts.map((t) => envelopeLevel(e, t, gate));
      for (const v of levels) {
        expect(Number.isFinite(v)).toBe(true);
        expect(v).toBeGreaterThanOrEqual(0);
        expect(v).toBeLessThanOrEqual(1);
      }
      const peak = gate === undefined ? e.attack : Math.min(e.attack, gate);
      for (let i = 1; i < ts.length; i += 1) {
        if (ts[i]! <= peak) expect(levels[i]!).toBeGreaterThanOrEqual(levels[i - 1]! - 1e-12);
        else if (ts[i - 1]! >= peak) { expect(levels[i]!).toBeLessThanOrEqual(levels[i - 1]! + 1e-12); seen.count('falling'); }
      }
      if (gate !== undefined && gate + e.release > gate) {
        expect(envelopeLevel(e, gate + e.release, gate)).toBe(0);
        seen.count('gated');
      }
    }), runs(RUNS));
    seen.atLeast('falling', RUNS);
    seen.atLeast('gated', RUNS / 4);
  }, timeoutFor(RUNS, 2));
});

describe('envelopePoints', () => {
  it('starts at zero time, runs forward, ends where the envelope settles, and traces envelopeLevel between', () => {
    const seen = tally();
    fc.assert(fc.property(resolved, fc.option(ms, { nil: undefined }), fc.array(fc.double({ min: 0, max: 1, noNaN: true }), { maxLength: 8 }), (e, gate, us) => {
      const points = envelopePoints(e, gate);
      expect(points[0]!.at).toBe(0);
      for (let i = 1; i < points.length; i += 1) expect(points[i]!.at).toBeGreaterThanOrEqual(points[i - 1]!.at);
      const last = points[points.length - 1]!;
      if (gate === undefined) {
        expect(last.value).toBe(e.sustain);
      } else {
        expect(last).toEqual({ at: gate + e.release, value: 0 });
      }
      const ts = [...us.map((u) => sample(e, gate, u)), ...points.map((p) => p.at)];
      for (const t of ts) {
        if (!Number.isFinite(t)) continue;
        const want = envelopeLevel(e, t, gate);
        const got = traced(points, t);
        const off = Math.min(...got.map((v) => Math.abs(v - want)));
        expect(off, `t=${t} points=${JSON.stringify(points)} level=${want} traced=${got}`).toBeLessThanOrEqual(1e-9);
        seen.count('sampled');
      }
      if (points.length >= 4) seen.count('four points');
    }), runs(RUNS));
    seen.atLeast('sampled', RUNS * 4);
    seen.atLeast('four points', RUNS / 10);
  }, timeoutFor(RUNS, 3));
});
