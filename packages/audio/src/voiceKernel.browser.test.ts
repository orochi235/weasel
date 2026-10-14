import { describe, expect, it } from 'vitest';
import { partialPresets } from './synthVoice';
import { CENTER_GAIN, renderEngine } from './testing/renderEngine';
import { centroid, peaks, powerSpectrum, rmsEnvelope } from './testing/spectrum';
import type { NoiseOptions, NoteOptions } from './types';
import { renderNoise, renderNote } from './voiceKernel';

// A kernel is a second implementation of what the node graph plays, so the
// graph is the reference: the same patch through both has to come out at the
// same level over time, at the same pitch, with the same brightness. Phase and
// band-limiting differ, so samples are not compared one for one.

const RATE = 48000;
const WINDOW = Math.round(RATE * 0.01);

async function graph(seconds: number, play: Parameters<typeof renderEngine>[1]): Promise<Float32Array> {
  const out = await renderEngine(seconds, play, RATE, { random: () => 0 });
  return out.map((v) => v / CENTER_GAIN);
}

function expectSameShape(kernel: Float32Array, real: Float32Array): void {
  const a = rmsEnvelope(kernel, WINDOW);
  const b = rmsEnvelope(real.subarray(0, kernel.length), WINDOW);
  expect(a.length).toBe(b.length);
  // A built-in wave's table is scaled to its own overshoot, so levels agree to a tenth, not exactly.
  for (let i = 0; i < a.length; i += 1) {
    expect(Math.abs(a[i] - b[i]), `window ${i}`).toBeLessThan(0.03 + 0.1 * b[i]);
  }
}

const top = (x: Float32Array): number => peaks(powerSpectrum(x, RATE), 1)[0];

describe('a note kernel against the node graph', () => {
  const notes: Record<string, NoteOptions> = {
    'a sine under an envelope': {
      pitch: 'A4', duration: 300, envelope: { attack: 40, decay: 60, sustain: 0.4, release: 120 },
    },
    'a square': { pitch: 220, wave: 'square', duration: 300, gain: 0.5 },
    'harmonic levels': { pitch: 330, wave: [1, 0.5, 0.25], duration: 300 },
    'a bell': { pitch: 'C5', wave: partialPresets.bell, duration: 400, envelope: { release: 200 } },
    'a glide': { pitch: 200, glide: { to: 800 }, duration: 300 },
  };

  for (const [name, note] of Object.entries(notes)) {
    it(`matches for ${name}`, async () => {
      const kernel = renderNote(note, RATE);
      const real = await graph(1, (e) => { e.playNote(note); });
      expectSameShape(kernel, real);
      if (!note.glide) expect(Math.abs(top(kernel) - top(real))).toBeLessThan(RATE / 2048);
    });
  }

  it('matches a filter sweep in brightness, early and late', async () => {
    const note: NoteOptions = {
      pitch: 110, wave: 'sawtooth', duration: 400,
      filter: { frequency: 200, amount: 5000, Q: 4, envelope: { attack: 0, decay: 150, sustain: 0 } },
    };
    const kernel = renderNote(note, RATE);
    const real = await graph(1, (e) => { e.playNote(note); });
    for (const [from, to] of [[0, 0.06], [0.3, 0.4]]) {
      const slice = (x: Float32Array): Float32Array => x.subarray(Math.round(from * RATE), Math.round(to * RATE));
      const k = centroid(powerSpectrum(slice(kernel), RATE));
      const r = centroid(powerSpectrum(slice(real), RATE));
      expect(Math.abs(k - r) / r).toBeLessThan(0.15);
    }
  });
});

describe('a noise kernel against the node graph', () => {
  it('matches a filtered burst, started at the same point in the loop', async () => {
    const noise: NoiseOptions = {
      noise: 'pink', duration: 250, envelope: { attack: 5, release: 80 },
      filter: { type: 'bandpass', frequency: 1200, Q: 2 },
    };
    const kernel = renderNoise(noise, RATE, () => 0);
    const real = await graph(1, (e) => { e.playNoise(noise); });
    expectSameShape(kernel, real);
  });
});
