import { describe, expect, it } from 'vitest';
import type { AudioEngine, PatternEvent } from '@weasel-js/audio';
import { CENTER_GAIN, renderEngine } from '@weasel-js/audio/testing/renderEngine';
import { octaveDensityDb, powerSpectrum, rms } from '@weasel-js/audio/testing/spectrum';
import { BED_STEPS, BED_TEMPO, bedDetune, bedEvents } from '../platformer/bed';
import { MUSIC_GAIN } from '../platformer/usePlatformerAudio';
import { oldBedPcm } from './platformerBedPcm';

// The bed used to be hand-written PCM, peak-normalized as a whole. It is engine
// voices now, and nobody has listened to the swap: this holds one pass of the
// voices to the old render's loudness and spectral balance instead.

const RATE = 48000;
const STEP_MS = 60_000 / BED_TEMPO / 4;
const PASS_SECONDS = (BED_STEPS * STEP_MS) / 1000;
const drift = bedDetune as (step: number) => number;
/** Past the end of the pass: an offline render outruns the scheduler's timer,
 *  so every voice has to be made before rendering starts. That also holds every
 *  voice's slot from the start, which is why the limit here is not the demo's. */
const LOOKAHEAD = PASS_SECONDS * 1000 + 1000;

/** One pass booked up front, as the pattern player books it a step at a time:
 *  an offline render outruns the timers the player steps on. */
const bookPass = (events: readonly PatternEvent[]) => (engine: AudioEngine) => {
  for (const e of events) {
    const when = e.step * STEP_MS;
    const detune = drift(e.step);
    if ('sound' in e) continue;
    const { step: _step, length = 1, ...voice } = e;
    const booked = { ...voice, detune, when, duration: length * STEP_MS };
    if ('noise' in booked) engine.playNoise(booked);
    else engine.playNote(booked);
  }
};

const OCTAVES = [63, 125, 250, 500, 1000, 2000, 4000];

function measure(pcm: Float32Array): { level: number; shape: number[] } {
  const spectrum = powerSpectrum(pcm, RATE, 4096);
  const db = OCTAVES.map((hz) => octaveDensityDb(spectrum, hz));
  const ref = db[OCTAVES.indexOf(500)];
  return { level: 20 * Math.log10(rms(pcm)), shape: db.map((d) => d - ref) };
}

/** The level the old bed was played at, on a music bus left at 1. */
const OLD_GAIN = 0.5;

describe('the bed as engine voices, against its old PCM', () => {
  it('matches the old loudness and spectral balance, and does not clip', async () => {
    const old = measure(oldBedPcm(RATE).map((v) => v * OLD_GAIN));
    // Where each strike's noise starts in its loop, fixed so the render repeats.
    let seed = 0x5eed;
    const random = () => (seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 0x100000000;
    const out = await renderEngine(PASS_SECONDS, bookPass(bedEvents()), RATE, { voiceLimit: 4096, lookahead: LOOKAHEAD, random });
    // The old bed went straight to a buffer; a voice passes a centered panner.
    const heard = out.map((v) => (v / CENTER_GAIN) * MUSIC_GAIN);
    const now = measure(heard);
    expect(Math.abs(now.level - old.level), 'level, dB').toBeLessThan(0.5);
    const shapeError = Math.max(...now.shape.map((d, i) => Math.abs(d - old.shape[i])));
    expect(shapeError, 'worst octave, dB').toBeLessThan(2);
    expect(heard.reduce((peak, v) => Math.max(peak, Math.abs(v)), 0), 'peak').toBeLessThan(1);
  });
});
