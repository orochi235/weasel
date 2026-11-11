/** Options for `impulseResponse`: the tail's decay, channel count and noise seed. */
export interface ImpulseResponseOptions {
  /** How far the tail falls by its end, dB. Default 60 (an RT60). Finite and at least -770, the most a tail can rise inside float32. */
  decayDb?: number;
  /** Default 2. */
  channels?: number;
  /** Seed for the noise, so the same call makes the same buffer. Default 1. */
  seed?: number;
}

/** The most a tail can rise, dB, and end inside float32's range. */
const MOST_RISE_DB = -770;

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Noise under an exponential decay that falls `decayDb` over `seconds`. */
export function impulseResponse(
  ctx: BaseAudioContext,
  seconds: number,
  opts: ImpulseResponseOptions = {},
): AudioBuffer {
  if (!(seconds > 0) || !Number.isFinite(seconds)) {
    throw new RangeError(`@weasel-js/audio: impulse length ${seconds} s must be finite and above 0`);
  }
  const decayDb = opts.decayDb ?? 60;
  const channels = opts.channels ?? 2;
  // A tail rising further than this ends past float32's range, and stores as Infinity.
  if (!(decayDb >= MOST_RISE_DB) || !Number.isFinite(decayDb)) {
    throw new RangeError(`@weasel-js/audio: impulse decay ${decayDb} dB must be finite and at least ${MOST_RISE_DB}`);
  }
  if (!Number.isInteger(channels) || channels < 1) {
    throw new RangeError(`@weasel-js/audio: impulse channels ${channels} must be a whole number above 0`);
  }
  const seed = opts.seed ?? 1;
  const length = Math.max(1, Math.round(seconds * ctx.sampleRate));
  const buffer = ctx.createBuffer(channels, length, ctx.sampleRate);
  const rate = (decayDb / 20) * Math.LN10;
  for (let c = 0; c < channels; c += 1) {
    const data = buffer.getChannelData(c);
    const rand = mulberry32(seed + c * 0x9e3779b1);
    for (let i = 0; i < length; i += 1) {
      data[i] = (rand() * 2 - 1) * Math.exp((-rate * i) / length);
    }
  }
  return buffer;
}
