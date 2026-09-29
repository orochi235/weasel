import { envelopeLevel, envelopePoints, resolveEnvelope, type ResolvedEnvelope } from './envelope';
import type { Inharmonic, NoiseColor, SynthPartial, VoiceFilter, Waveform } from './types';

/** Seconds of noise in each cached loop: long enough that the repeat is not
 *  heard as a pitch. */
const NOISE_SECONDS = 2;
/** Every color is scaled to this RMS, so changing color does not change level. */
const NOISE_RMS = 0.25;

const noiseCache = new WeakMap<BaseAudioContext, Map<NoiseColor, AudioBuffer>>();

/** Samples of `color` noise, seeded so every context gets the same loop. The
 *  end is pulled onto the start, so the loop point does not click. */
export function noiseSamples(color: NoiseColor, length: number): Float32Array {
  const out = new Float32Array(length);
  let s = 0x9e3779b9;
  const white = (): number => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return (s / 0x100000000) * 2 - 1;
  };
  if (color === 'white') {
    for (let i = 0; i < length; i += 1) out[i] = white();
  } else if (color === 'pink') {
    // Paul Kellet's refined filter: within 0.05 dB of -3 dB/octave above 9 Hz.
    let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
    for (let i = 0; i < length; i += 1) {
      const w = white();
      b0 = 0.99886 * b0 + w * 0.0555179;
      b1 = 0.99332 * b1 + w * 0.0750759;
      b2 = 0.969 * b2 + w * 0.153852;
      b3 = 0.8665 * b3 + w * 0.3104856;
      b4 = 0.55 * b4 + w * 0.5329522;
      b5 = -0.7616 * b5 - w * 0.016898;
      out[i] = b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362;
      b6 = w * 0.115926;
    }
  } else {
    // A leaky integrator: -6 dB/octave down to a few Hz, without wandering off.
    let y = 0;
    for (let i = 0; i < length; i += 1) {
      y = (y + 0.02 * white()) / 1.02;
      out[i] = y;
    }
  }
  const step = (out[length - 1] - out[0]) / Math.max(1, length - 1);
  let mean = 0;
  for (let i = 0; i < length; i += 1) {
    out[i] -= step * i;
    mean += out[i];
  }
  mean /= length;
  let sq = 0;
  for (let i = 0; i < length; i += 1) {
    out[i] -= mean;
    sq += out[i] * out[i];
  }
  const scale = sq > 0 ? NOISE_RMS / Math.sqrt(sq / length) : 0;
  for (let i = 0; i < length; i += 1) out[i] *= scale;
  return out;
}

/** One looping noise buffer per color per context, made on first use. */
export function noiseBuffer(ctx: BaseAudioContext, color: NoiseColor): AudioBuffer {
  let byColor = noiseCache.get(ctx);
  if (!byColor) {
    byColor = new Map();
    noiseCache.set(ctx, byColor);
  }
  let buffer = byColor.get(color);
  if (!buffer) {
    const length = Math.round(ctx.sampleRate * NOISE_SECONDS);
    buffer = ctx.createBuffer(1, length, ctx.sampleRate);
    buffer.getChannelData(0).set(noiseSamples(color, length));
    byColor.set(color, buffer);
  }
  return buffer;
}

export const isInharmonic = (wave: Waveform): wave is Inharmonic =>
  typeof wave === 'object' && !Array.isArray(wave);

/** Partials with their levels normalized to sum to 1, checked where the note
 *  was written rather than when it comes due. */
export function resolvePartials(wave: Inharmonic): (SynthPartial & { gain: number })[] {
  if (wave.partials.length === 0) {
    throw new RangeError('@weasel-js/audio: an inharmonic wave needs at least one partial');
  }
  let total = 0;
  for (const p of wave.partials) {
    if (!(p.ratio > 0) || !Number.isFinite(p.ratio)) {
      throw new RangeError(`@weasel-js/audio: partial ratio must be a positive number, got ${p.ratio}`);
    }
    if (p.decay !== undefined && !(p.decay > 0)) {
      throw new RangeError(`@weasel-js/audio: partial decay must be a positive number of ms, got ${p.decay}`);
    }
    total += Math.abs(p.gain ?? 1);
  }
  return wave.partials.map((p) => ({
    ratio: p.ratio,
    gain: total > 0 ? (p.gain ?? 1) / total : 0,
    decay: p.decay,
  }));
}

/** An envelope written onto a param from `t0` (seconds), mapped through `map`,
 *  and the note-off that releases it from wherever it has got to. */
export function envelopeOnParam(
  param: AudioParam,
  env: ResolvedEnvelope,
  gate: number | undefined,
  t0: number,
  map: (level: number) => number,
): { release(at: number): void } {
  const [first, ...rest] = envelopePoints(env, gate);
  param.setValueAtTime(map(first.value), t0);
  for (const p of rest) param.linearRampToValueAtTime(map(p.value), t0 + p.at / 1000);
  return {
    release(at) {
      const elapsed = Math.max(0, (at - t0) * 1000);
      param.cancelScheduledValues(at);
      param.setValueAtTime(map(envelopeLevel(env, elapsed)), at);
      param.linearRampToValueAtTime(map(0), at + env.release / 1000);
    },
  };
}

/** A voice filter's node, scheduled from `t0`, with its envelope's release. */
export function voiceFilter(
  ctx: BaseAudioContext,
  spec: VoiceFilter,
  gate: number | undefined,
  t0: number,
): { node: BiquadFilterNode; release(at: number): void } {
  const node = ctx.createBiquadFilter();
  node.type = spec.type ?? 'lowpass';
  node.Q.setValueAtTime(spec.Q ?? 1, t0);
  if (spec.gain !== undefined) node.gain.setValueAtTime(spec.gain, t0);
  const amount = spec.amount ?? 0;
  if (!spec.envelope || amount === 0) {
    node.frequency.setValueAtTime(spec.frequency, t0);
    return { node, release: () => {} };
  }
  const cutoff = envelopeOnParam(
    node.frequency, resolveEnvelope(spec.envelope), gate, t0, (v) => spec.frequency + amount * v,
  );
  return { node, release: cutoff.release };
}

/**
 * Ready-made inharmonic waves. The ratios are the textbook modes of each
 * object; the levels and decays are a starting point to spread and adjust.
 */
export const partialPresets = {
  /** A church bell's hum, prime, tierce, quint and nominal, and above. */
  bell: {
    partials: [
      { ratio: 0.5, gain: 0.6, decay: 1800 },
      { ratio: 1, gain: 1, decay: 1200 },
      { ratio: 1.183, gain: 0.7, decay: 900 },
      { ratio: 1.506, gain: 0.4, decay: 700 },
      { ratio: 2, gain: 0.8, decay: 600 },
      { ratio: 2.514, gain: 0.3, decay: 400 },
      { ratio: 2.662, gain: 0.25, decay: 350 },
      { ratio: 3.011, gain: 0.2, decay: 300 },
    ],
  },
  /** A tuned bar: its overtones sit near 4 and 10 times the fundamental and die fast. */
  marimba: {
    partials: [
      { ratio: 1, gain: 1, decay: 350 },
      { ratio: 3.984, gain: 0.35, decay: 90 },
      { ratio: 9.95, gain: 0.12, decay: 30 },
    ],
  },
  /** Struck sheet metal: modes nowhere near the harmonic series. */
  metal: {
    partials: [
      { ratio: 1, gain: 1, decay: 160 },
      { ratio: 1.71, gain: 0.53, decay: 120 },
      { ratio: 2.43, gain: 0.36, decay: 94 },
      { ratio: 3.19, gain: 0.27, decay: 78 },
      { ratio: 4.61, gain: 0.22, decay: 66 },
      { ratio: 5.87, gain: 0.18, decay: 58 },
    ],
  },
} satisfies Record<string, Inharmonic>;
