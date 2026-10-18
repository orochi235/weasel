/**
 * Synth voices as arithmetic: the samples `playNote` and `playNoise` make,
 * computed with no `AudioContext`. A kernel renders a block at a time, so it
 * can run wherever samples are wanted: an offline render into a buffer, or the
 * inside of an `AudioWorkletProcessor`.
 */
import { biquadCoefficients } from './biquad';
import { envelopeLevel, resolveEnvelope, type Envelope } from './envelope';
import { sineShape, waveShape } from './oscillator';
import { NOISE_SECONDS, isInharmonic, noiseSamples, resolveNote } from './synthVoice';
import type { NoiseColor, NoiseOptions, NoteOptions, VoiceFilter } from './types';

/** What of a `playNote` call shapes its samples. Routing, position, and timing
 *  belong to whatever plays them. */
export type KernelNote = Pick<
  NoteOptions, 'pitch' | 'wave' | 'envelope' | 'glide' | 'filter' | 'duration' | 'gain' | 'detune'
>;

/** What of a `playNoise` call shapes its samples. */
export type KernelNoise = Pick<
  NoiseOptions, 'noise' | 'envelope' | 'filter' | 'duration' | 'gain' | 'rate' | 'detune'
>;

/** One voice, rendered a block at a time. */
export interface VoiceKernel {
  /** Add the voice's next samples into `out[from..to)`, the whole of `out` by
   *  default. False once the voice has ended; it adds nothing from then on. */
  render(out: Float32Array, from?: number, to?: number): boolean;
  /** Note-off at the next sample: the envelopes release from wherever they
   *  have got to. Does nothing once the gate has closed. */
  release(): void;
  /** What `setRate` and `setDetune` do to a sounding voice. `detune` is cents. */
  retune(rate: number, detune: number): void;
}

/** One raw sample, `t` ms into the voice, with its pitch multiplied by `tune`. */
type Source = (t: number, tune: number) => number;

interface Shaping {
  envelope?: Envelope;
  filter?: VoiceFilter;
  duration?: number;
  gain?: number;
  rate?: number;
  detune?: number;
}

const tuning = (rate: number, detune: number): number => rate * 2 ** (detune / 1200);

/** A voice filter as a function of one sample, its cutoff following its envelope. */
function filterStage(
  spec: VoiceFilter,
  sampleRate: number,
): (x: number, t: number, gate: number | undefined) => number {
  const type = spec.type ?? 'lowpass';
  const amount = spec.amount ?? 0;
  const env = spec.envelope && amount !== 0 ? resolveEnvelope(spec.envelope) : null;
  const coefficients = biquadCoefficients(type, spec.frequency, sampleRate, spec.Q, spec.gain);
  let cutoff = spec.frequency;
  let z1 = 0;
  let z2 = 0;
  return (x, t, gate) => {
    if (env) {
      const hz = spec.frequency + amount * envelopeLevel(env, t, gate);
      if (hz !== cutoff) {
        cutoff = hz;
        biquadCoefficients(type, hz, sampleRate, spec.Q, spec.gain, coefficients);
      }
    }
    const y = coefficients.b0 * x + z1;
    z1 = coefficients.b1 * x - coefficients.a1 * y + z2;
    z2 = coefficients.b2 * x - coefficients.a2 * y;
    return y;
  };
}

/** What every kernel shares once it has a source: source → optional filter →
 *  envelope, the gate, and the end at the close of the release. */
function createKernel(patch: Shaping, sampleRate: number, source: Source): VoiceKernel {
  const env = resolveEnvelope(patch.envelope);
  const gain = patch.gain ?? 1;
  const filter = patch.filter ? filterStage(patch.filter, sampleRate) : null;
  const msPerSample = 1000 / sampleRate;
  let gate = patch.duration;
  let tune = tuning(patch.rate ?? 1, patch.detune ?? 0);
  let n = 0;
  let ended = false;
  return {
    render(out, from = 0, to = out.length) {
      if (ended) return false;
      for (let i = from; i < to; i += 1) {
        const t = n * msPerSample;
        if (gate !== undefined && t >= gate + env.release) {
          ended = true;
          return false;
        }
        const raw = source(t, tune);
        out[i] += gain * envelopeLevel(env, t, gate) * (filter ? filter(raw, t, gate) : raw);
        n += 1;
      }
      return true;
    },
    release() {
      const t = n * msPerSample;
      if (gate === undefined || t < gate) gate = t;
    },
    retune(rate, detune) {
      tune = tuning(rate, detune);
    },
  };
}

/** A `playNote` voice. Throws on a bad pitch or partial, as `playNote` does. */
export function createNoteKernel(note: KernelNote, sampleRate: number): VoiceKernel {
  const { from, glideTo, partials } = resolveNote(note);
  const glideMs = note.glide?.ms ?? note.duration ?? 100;
  const linear = note.glide?.curve === 'linear';
  const wave = note.wave ?? 'sine';
  const shape = isInharmonic(wave) ? sineShape : waveShape(wave);
  const tones: { ratio: number; gain: number; decay?: number; phase: number }[] = partials
    ? partials.map((p) => ({ ratio: p.ratio, gain: p.gain, decay: p.decay, phase: 0 }))
    : [{ ratio: 1, gain: 1, phase: 0 }];
  return createKernel(note, sampleRate, (t, tune) => {
    let hz = from;
    if (glideTo !== undefined) {
      const k = glideMs > 0 ? Math.min(1, t / glideMs) : 1;
      hz = linear ? from + (glideTo - from) * k : from * (glideTo / from) ** k;
    }
    const cycles = (hz * tune) / sampleRate;
    let sum = 0;
    for (const tone of tones) {
      const dt = cycles * tone.ratio;
      // An oscillator at or past Nyquist is silent, not folded back.
      if (dt >= 0.5) continue;
      const level = tone.decay === undefined ? tone.gain : tone.gain * Math.exp(-t / tone.decay);
      sum += level * shape(tone.phase, dt);
      tone.phase = (tone.phase + dt) % 1;
    }
    return sum;
  });
}

const loops = new Map<string, Float32Array>();

/** The loop `noiseBuffer` gives a context at this rate, made once per color and rate. */
function noiseLoop(color: NoiseColor, sampleRate: number): Float32Array {
  const key = `${color}:${sampleRate}`;
  let loop = loops.get(key);
  if (!loop) {
    loop = noiseSamples(color, Math.round(sampleRate * NOISE_SECONDS));
    loops.set(key, loop);
  }
  return loop;
}

/** A `playNoise` voice. `random` picks where in the loop it starts. */
export function createNoiseKernel(
  noise: KernelNoise,
  sampleRate: number,
  random: () => number = Math.random,
): VoiceKernel {
  const loop = noiseLoop(noise.noise, sampleRate);
  // On a whole sample: between two, white noise is their average, and quieter for it.
  let at = Math.floor(random() * loop.length);
  return createKernel(noise, sampleRate, (_t, tune) => {
    const i = Math.floor(at);
    const a = loop[i];
    const sample = a + (loop[(i + 1) % loop.length] - a) * (at - i);
    at = (at + tune) % loop.length;
    return sample;
  });
}

function renderWhole(kernel: VoiceKernel, patch: Shaping, sampleRate: number, what: string): Float32Array {
  if (patch.duration === undefined) {
    throw new RangeError(`@weasel-js/audio: ${what} needs a duration to know where the voice ends`);
  }
  const total = patch.duration + resolveEnvelope(patch.envelope).release;
  const out = new Float32Array(Math.round((total * sampleRate) / 1000));
  kernel.render(out);
  return out;
}

/** A whole note as samples, through its release: `duration + release` ms at
 *  `sampleRate`. Put them in an `AudioBuffer` and `engine.register` it to play
 *  the note as a sound. */
export function renderNote(note: KernelNote, sampleRate: number): Float32Array {
  return renderWhole(createNoteKernel(note, sampleRate), note, sampleRate, 'renderNote');
}

/** A whole noise voice as samples, through its release. */
export function renderNoise(
  noise: KernelNoise,
  sampleRate: number,
  random: () => number = Math.random,
): Float32Array {
  return renderWhole(createNoiseKernel(noise, sampleRate, random), noise, sampleRate, 'renderNoise');
}
