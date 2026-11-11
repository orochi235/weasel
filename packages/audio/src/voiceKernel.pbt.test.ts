/**
 * Voice kernels for any note or noise the engine accepts, filtered or not: every sample finite, a sine never
 * louder than its gain, the voice ending on the first sample at or past its gate plus its release (or a release
 * called partway), and the same samples whether a block is rendered whole or in pieces.
 */
import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { createNoiseKernel, createNoteKernel, type KernelNoise, type KernelNote, type VoiceKernel } from './voiceKernel';
import { resolveEnvelope } from './envelope';
import { runs, tally, timeoutFor } from './pbt.fixture';
import type { VoiceFilter } from './types';

const RUNS = 120;
const rate = fc.constantFrom(8000, 22050, 44100, 48000);
const time = fc.oneof(fc.integer({ min: 0, max: 20 }), fc.double({ min: 0, max: 20, noNaN: true }));
const envelope = fc.record({ attack: time, decay: time, sustain: fc.double({ min: 0, max: 1, noNaN: true }), release: time }, { requiredKeys: [] });
const filter: fc.Arbitrary<VoiceFilter> = fc.record({
  type: fc.constantFrom<BiquadFilterType>('lowpass', 'highpass', 'bandpass', 'lowshelf', 'highshelf', 'peaking', 'notch', 'allpass'),
  frequency: fc.oneof(fc.integer({ min: 20, max: 20000 }), fc.double({ min: -1e6, max: 1e6, noNaN: true })),
  Q: fc.oneof(fc.double({ min: 0.1, max: 20, noNaN: true }), fc.double({ min: -40, max: 40, noNaN: true })),
  gain: fc.double({ min: -40, max: 40, noNaN: true }),
  envelope,
  amount: fc.oneof(fc.constant(0), fc.integer({ min: -20000, max: 20000 })),
}, { requiredKeys: ['frequency'] });
const common = {
  envelope, gain: fc.double({ min: -2, max: 2, noNaN: true }), detune: fc.integer({ min: -2400, max: 2400 }),
  duration: fc.option(time, { nil: undefined }), filter: fc.option(filter, { nil: undefined }),
};
const note: fc.Arbitrary<KernelNote> = fc.record({
  ...common,
  pitch: fc.oneof(fc.integer({ min: 20, max: 20000 }), fc.integer({ min: 0, max: 127 }).map((midi) => ({ midi })), fc.constantFrom('A4', 'C#2', 'Bb7')),
  wave: fc.oneof(
    fc.constantFrom<'sine' | 'square' | 'sawtooth' | 'triangle'>('sine', 'square', 'sawtooth', 'triangle'),
    fc.array(fc.double({ min: -1, max: 1, noNaN: true }), { minLength: 1, maxLength: 6 }),
    fc.record({ partials: fc.array(fc.record({ ratio: fc.double({ min: 0.1, max: 8, noNaN: true }), gain: fc.double({ min: -1, max: 1, noNaN: true }), decay: fc.option(fc.double({ min: 1, max: 100, noNaN: true }), { nil: undefined }) }, { requiredKeys: ['ratio'] }), { minLength: 1, maxLength: 4 }) }),
  ),
  glide: fc.option(fc.record({ to: fc.integer({ min: 20, max: 20000 }), ms: fc.option(time, { nil: undefined }), curve: fc.constantFrom<'linear' | 'exponential'>('linear', 'exponential') }, { requiredKeys: ['to'] }), { nil: undefined }),
}, { requiredKeys: ['pitch'] });
const noise: fc.Arbitrary<KernelNoise> = fc.record({
  ...common,
  noise: fc.constantFrom<'white' | 'pink' | 'brown'>('white', 'pink', 'brown'),
  rate: fc.double({ min: 0.1, max: 4, noNaN: true }),
}, { requiredKeys: ['noise'] });
type Voice = { kind: 'note'; patch: KernelNote } | { kind: 'noise'; patch: KernelNoise };
const voice: fc.Arbitrary<Voice> = fc.oneof(
  note.map((n) => ({ kind: 'note' as const, patch: n })),
  note.map(({ filter: _f, ...n }): Voice => ({ kind: 'note', patch: { ...n, wave: 'sine' } })),
  noise.map((n) => ({ kind: 'noise' as const, patch: n })),
);

const make = (v: Voice, sr: number): VoiceKernel => (v.kind === 'note' ? createNoteKernel(v.patch, sr) : createNoiseKernel(v.patch, sr, () => 0.25));

/** The sample count a voice gated at `gate` ms runs for: every sample before gate + release. */
function lifetime(gate: number, release: number, sr: number): number {
  const msPerSample = 1000 / sr;
  let n = 0;
  while (n * msPerSample < gate + release) n += 1;
  return n;
}

describe('voice kernels', () => {
  it('render finite samples, a sine within its gain, and end on the first sample past gate and release', () => {
    const seen = tally();
    fc.assert(fc.property(voice, rate, fc.option(fc.integer({ min: 0, max: 1200 }), { nil: undefined }), (v, sr, releaseAt) => {
      const k = make(v, sr);
      const release = resolveEnvelope(v.patch.envelope).release;
      const cap = Math.ceil(sr * 0.06);
      const out = new Float32Array(cap);
      let alive = 0;
      let gate = v.patch.duration;
      for (let i = 0; i < cap; i += 1) {
        if (i === releaseAt) {
          k.release();
          const t = i * (1000 / sr);
          if (gate === undefined || t < gate) gate = t;
        }
        if (!k.render(out, i, i + 1)) break;
        alive += 1;
      }
      for (const x of out) expect(Number.isFinite(x)).toBe(true);
      if (gate !== undefined && lifetime(gate, release, sr) < cap) {
        expect(alive).toBe(lifetime(gate, release, sr));
        expect(k.render(out)).toBe(false);
        seen.count('ended');
      } else {
        expect(alive).toBe(cap);
      }
      if (v.kind === 'note' && (v.patch.wave ?? 'sine') === 'sine' && !v.patch.filter) {
        const g = Math.abs(v.patch.gain ?? 1);
        for (const x of out) expect(Math.abs(x)).toBeLessThanOrEqual(g * (1 + 1e-6) + 1e-7);
        seen.count('sine');
      }
      if (v.patch.filter) seen.count('filtered');
    }), runs(RUNS));
    for (const what of ['ended', 'sine', 'filtered']) seen.atLeast(what, RUNS / 20);
  }, timeoutFor(RUNS, 40));

  it('render the same samples whole or in blocks', () => {
    fc.assert(fc.property(voice, rate, fc.array(fc.integer({ min: 1, max: 300 }), { minLength: 1, maxLength: 6 }), (v, sr, blocks) => {
      const n = Math.ceil(sr * 0.03);
      const whole = new Float32Array(n);
      make(v, sr).render(whole);
      const pieces = new Float32Array(n);
      const k = make(v, sr);
      for (let at = 0, i = 0; at < n; i += 1) {
        const to = Math.min(n, at + blocks[i % blocks.length]!);
        k.render(pieces, at, to);
        at = to;
      }
      expect(pieces).toEqual(whole);
    }), runs(RUNS));
  }, timeoutFor(RUNS, 40));
});
