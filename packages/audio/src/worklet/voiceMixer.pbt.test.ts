/**
 * Properties of the voice mixer over notes and noises booked at any time, level ramps, pans, retunes, releases,
 * and stops, at sample rates from 3 kHz to 768 kHz. Rendering in blocks of any sizes makes the same samples and
 * ends the same voices as rendering in quanta of 128 (a metamorphic rule); every sample is finite; each voice is
 * reported ended once, and adds nothing after; and nothing sounds before a voice's start or from its stop on.
 */
import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import type { ToProcessor } from './protocol';
import { createVoiceMixer } from './voiceMixer';
import { runs, tally, timeoutFor } from '../pbt.fixture';

const seen = tally();
const RATES = [3000, 22050, 48000, 768000] as const;
const FRAMES = 2048;

interface Plan { rate: number; events: ToProcessor[] }

const plan: fc.Arbitrary<Plan> = fc.constantFrom(...RATES).chain((rate) => {
  const span = FRAMES / rate;
  const time = fc.oneof(fc.double({ min: 0, max: span, noNaN: true }), fc.constantFrom(0, span / 2, 1e-12));
  const voice = fc.record({
    kind: fc.constantFrom('note' as const, 'noise' as const),
    id: fc.integer({ min: 1, max: 4 }),
    at: time,
    level: fc.double({ min: 0, max: 1, noNaN: true }),
    pan: fc.double({ min: -2, max: 2, noNaN: true }),
    rate: fc.double({ min: 0.25, max: 4, noNaN: true }),
    detune: fc.integer({ min: -1200, max: 1200 }),
    duration: fc.oneof(fc.double({ min: 0, max: 30, noNaN: true }), fc.constant(undefined)),
    pitch: fc.double({ min: 20, max: 20000, noNaN: true }),
    seed: fc.double({ min: 0, max: 0.999, noNaN: true }),
  }).map((v): ToProcessor => {
    const shape = { envelope: { attack: 1, release: 3 }, ...(v.duration !== undefined ? { duration: v.duration } : {}) };
    const start = { id: v.id, at: v.at, level: v.level, pan: v.pan, rate: v.rate, detune: v.detune };
    return v.kind === 'note'
      ? { kind: 'note', ...start, patch: { pitch: v.pitch, ...shape } }
      : { kind: 'noise', ...start, seed: v.seed, patch: { noise: 'white', ...shape } };
  });
  const id = fc.integer({ min: 1, max: 4 });
  const change: fc.Arbitrary<ToProcessor> = fc.oneof(
    fc.record({ kind: fc.constant('level' as const), id, value: fc.double({ min: 0, max: 1, noNaN: true }), end: fc.oneof(fc.constant(0), time) }),
    fc.record({ kind: fc.constant('pan' as const), id, value: fc.double({ min: -1, max: 1, noNaN: true }) }),
    fc.record({ kind: fc.constant('retune' as const), id, rate: fc.double({ min: 0.5, max: 2, noNaN: true }), detune: fc.integer({ min: -100, max: 100 }) }),
    fc.record({ kind: fc.constant('release' as const), id }),
    fc.record({ kind: fc.constant('stop' as const), id, at: time }),
  );
  return fc.tuple(fc.uniqueArray(voice, { selector: (v) => (v as { id: number }).id, minLength: 1, maxLength: 4 }), fc.array(change, { maxLength: 6 }))
    .map(([voices, changes]) => ({ rate, events: [...voices, ...changes] }));
});

/** Render `FRAMES` frames in blocks of `sizes` cycled, with every event received before the first. */
function render(p: Plan, sizes: readonly number[]) {
  const mixer = createVoiceMixer(p.rate);
  for (const e of p.events) mixer.receive(e, 0);
  const left = new Float32Array(FRAMES);
  const right = new Float32Array(FRAMES);
  const ended = new Map<number, number>();
  let frame = 0;
  for (let k = 0; frame < FRAMES; k += 1) {
    const n = Math.min(sizes[k % sizes.length], FRAMES - frame);
    for (const id of mixer.render(left.subarray(frame, frame + n), right.subarray(frame, frame + n), frame)) {
      expect(ended.has(id)).toBe(false);
      ended.set(id, frame + n);
    }
    frame += n;
  }
  return { left, right, ended, size: mixer.size() };
}

describe('the voice mixer', () => {
  it('renders the same samples and ends the same voices in blocks of any size as in quanta of 128', () => {
    fc.assert(fc.property(plan, fc.array(fc.integer({ min: 1, max: 300 }), { minLength: 1, maxLength: 8 }), (p, sizes) => {
      const a = render(p, [128]);
      const b = render(p, sizes);
      expect(a.left.every(Number.isFinite) && a.right.every(Number.isFinite)).toBe(true);
      // The sign of a zero is the only thing the order of a sum may change.
      const unsigned = (x: Float32Array): number[] => Array.from(x, (v) => v + 0);
      expect(unsigned(b.left)).toEqual(unsigned(a.left));
      expect(unsigned(b.right)).toEqual(unsigned(a.right));
      expect([...b.ended.keys()].sort()).toEqual([...a.ended.keys()].sort());
      expect(b.size).toBe(a.size);
      seen.count(a.ended.size > 0 ? 'ended' : 'none ended');
      if (a.left.some((v) => v !== 0)) seen.count('sounded');
    }), runs(150));
    seen.atLeast('ended', 20);
    seen.atLeast('sounded', 20);
  }, timeoutFor(150, 30));

  it('is silent before each voice starts and from where it is stopped', () => {
    fc.assert(fc.property(plan, (p) => {
      const starts = new Map<number, number>();
      let stopAt = Infinity;
      for (const e of p.events) if (e.kind === 'note' || e.kind === 'noise') starts.set(e.id, Math.round(e.at * p.rate));
      const onlyStarts = p.events.filter((e) => e.kind === 'note' || e.kind === 'noise');
      // One voice, stopped where the plan's first stop for it says.
      const first = onlyStarts[0] as Extract<ToProcessor, { kind: 'note' }>;
      const stop = p.events.find((e) => e.kind === 'stop' && e.id === first.id) as Extract<ToProcessor, { kind: 'stop' }> | undefined;
      if (stop) stopAt = Math.max(0, Math.round(stop.at * p.rate));
      const one: Plan = { rate: p.rate, events: [first, ...(stop ? [stop] : [])] };
      const { left, right, ended } = render(one, [128]);
      const start = starts.get(first.id)!;
      for (let i = 0; i < FRAMES; i += 1) {
        if (i < start || i >= stopAt) {
          expect(left[i]).toBe(0);
          expect(right[i]).toBe(0);
        }
      }
      if (stopAt < FRAMES) {
        expect(ended.has(first.id)).toBe(true);
        seen.count('stopped');
      }
    }), runs(150));
    seen.atLeast('stopped', 10);
  }, timeoutFor(150, 15));
});
