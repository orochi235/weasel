import { describe, expect, it } from 'vitest';
import type { AudioEngine } from '@weasel-js/audio';
import { renderEngine } from '@weasel-js/audio/testing/renderEngine';
import { octaveDensityDb, powerSpectrum, rms, rmsEnvelope } from '@weasel-js/audio/testing/spectrum';
import { playSound, type PcmSoundName } from '../platformer/sfx';
import type { SoundHandle } from '@weasel-js/audio';

// Step and land used to be hand-written PCM. They are engine voices now, and
// nobody has listened to the swap: this holds the new voices to the old
// renders' loudness, envelope and spectral shape instead. The old renderers
// are frozen here as they were.

const RATE = 48000;

function lcg(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return (s / 0x100000000) * 2 - 1;
  };
}
const env = (i: number, n: number, attack: number, release: number): number => {
  const a = Math.max(1, Math.floor(n * attack));
  const r = Math.max(1, Math.floor(n * release));
  if (i < a) return i / a;
  if (i > n - r) return Math.max(0, (n - i) / r);
  return 1;
};
function lowpass(buf: Float32Array, alpha: number): void {
  let prev = 0;
  for (let i = 0; i < buf.length; i++) {
    prev += alpha * (buf[i] - prev);
    buf[i] = prev;
  }
}
const OLD = {
  step(): Float32Array {
    const n = Math.floor(RATE * 0.07);
    const rnd = lcg(0x51ed11);
    const out = new Float32Array(n);
    for (let i = 0; i < n; i++) out[i] = rnd();
    lowpass(out, 0.09);
    for (let i = 0; i < n; i++) out[i] *= 0.55 * env(i, n, 0.02, 0.8);
    return out;
  },
  land(): Float32Array {
    const n = Math.floor(RATE * 0.14);
    const rnd = lcg(0x0dd1e5);
    const out = new Float32Array(n);
    let phase = 0;
    for (let i = 0; i < n; i++) {
      phase += (2 * Math.PI * (180 + (60 - 180) * (i / n))) / RATE;
      out[i] = Math.sin(phase) * 0.3 * env(i, n, 0.01, 0.5);
    }
    const thump = new Float32Array(n);
    for (let i = 0; i < n; i++) thump[i] = rnd();
    lowpass(thump, 0.04);
    for (let i = 0; i < n; i++) out[i] += thump[i] * 0.25 * env(i, n, 0.01, 0.9);
    return out;
  },
};

const OCTAVES = [125, 250, 500, 1000, 2000, 4000, 8000, 16000];
/** Renders averaged per measurement: one noise burst is too short to have a
 *  steady spectrum. */
const TAKES = 24;
const WINDOW = Math.round(RATE * 0.01);

interface Measure { level: number; shape: number[]; envelope: number[] }

/** Mean RMS, octave densities relative to the 1 kHz octave, and the 10 ms RMS
 *  envelope scaled to sum to 1, over `takes` renders of `play`. */
async function measure(play: (e: AudioEngine) => void, takes: number): Promise<Measure> {
  const bands = new Array(OCTAVES.length).fill(0);
  let power = 0;
  let envelope: number[] = [];
  for (let t = 0; t < takes; t++) {
    const out = await renderEngine(0.2, play, RATE);
    const s = powerSpectrum(out, RATE, 1024);
    OCTAVES.forEach((hz, i) => { bands[i] += 10 ** (octaveDensityDb(s, hz) / 10); });
    power += rms(out) ** 2;
    const e = rmsEnvelope(out, WINDOW);
    envelope = envelope.length ? envelope.map((v, i) => v + e[i]) : e;
  }
  const db = bands.map((b) => 10 * Math.log10(b / takes));
  const ref = db[OCTAVES.indexOf(1000)];
  const total = envelope.reduce((a, b) => a + b, 0);
  return {
    level: 10 * Math.log10(power / takes),
    shape: db.map((d) => d - ref),
    envelope: envelope.map((v) => v / total),
  };
}

const playOld = (pcm: Float32Array) => (e: AudioEngine) => {
  const buffer = e.context.createBuffer(1, pcm.length, RATE);
  buffer.getChannelData(0).set(pcm);
  e.play(e.register(buffer));
};
const playNew = (name: 'step' | 'land') => (e: AudioEngine) => {
  playSound(e, {} as Record<PcmSoundName, SoundHandle>, name);
};

describe.each(['step', 'land'] as const)('%s as engine voices, against its old PCM', (name) => {
  it('matches loudness, spectral shape and envelope', async () => {
    const old = await measure(playOld(OLD[name]()), 1);
    const now = await measure(playNew(name), TAKES);
    expect(Math.abs(now.level - old.level), 'level, dB').toBeLessThan(1.5);
    const shapeError = Math.max(...now.shape.map((d, i) => Math.abs(d - old.shape[i])));
    expect(shapeError, 'worst octave, dB').toBeLessThan(4);
    const oldPeak = Math.max(...old.envelope);
    const envError = Math.max(...now.envelope.map((v, i) => Math.abs(v - old.envelope[i]))) / oldPeak;
    expect(envError, 'worst 10 ms window, of the old peak').toBeLessThan(0.15);
  });
});
