import type { AudioEngine, SoundHandle } from '@weasel-js/audio';

export const SOUND_NAMES = ['step', 'jump', 'land', 'coin', 'stomp', 'hurt', 'goal', 'bed'] as const;
export type SoundName = (typeof SOUND_NAMES)[number];

/** Deterministic noise — `Math.random` would make the tests unrepeatable. */
function noise(seed: number): () => number {
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

/** A one-pole lowpass, for turning white noise into something footstep-shaped. */
function lowpass(buf: Float32Array, alpha: number): void {
  let prev = 0;
  for (let i = 0; i < buf.length; i++) {
    prev += alpha * (buf[i] - prev);
    buf[i] = prev;
  }
}

function tone(n: number, rate: number, from: number, to: number, gain: number, harmonic = 0): Float32Array {
  const out = new Float32Array(n);
  let phase = 0;
  for (let i = 0; i < n; i++) {
    const u = i / n;
    const f = from + (to - from) * u;
    phase += (2 * Math.PI * f) / rate;
    const base = Math.sin(phase) + (harmonic ? harmonic * Math.sin(phase * 2) : 0);
    out[i] = base * gain * env(i, n, 0.01, 0.5);
  }
  return out;
}

/** A plucked note: fast attack, exponential decay, sine plus two falling harmonics. */
function pluck(n: number, rate: number, freq: number, gain: number, decay: number): Float32Array {
  const out = new Float32Array(n);
  const attack = Math.max(1, Math.floor(rate * 0.005));
  for (let i = 0; i < n; i++) {
    const t = i / rate;
    const a = i < attack ? i / attack : 1;
    const wave = Math.sin(2 * Math.PI * freq * t) + 0.35 * Math.sin(4 * Math.PI * freq * t) + 0.15 * Math.sin(6 * Math.PI * freq * t);
    out[i] = wave * gain * a * Math.exp(-t / decay);
  }
  return out;
}

/** A 120bpm pentatonic riff over a four-chord bass, built so its last sample
 *  lands back near zero and the loop point is inaudible. */
function bed(rate: number): Float32Array {
  const n = Math.floor(rate * 4);
  const out = new Float32Array(n);
  const melody = [523.25, 392.0, 329.63, 392.0]; // C5 G4 E4 G4, C major pentatonic
  const bass = [65.41, 98.0, 110.0, 87.31]; // C2 G2 A2 F2

  const steps = 16;
  const stepLen = Math.floor(n / steps);
  for (let s = 0; s < steps; s++) {
    const start = s * stepLen;
    const note = pluck(stepLen, rate, melody[s % melody.length], 0.16, stepLen / rate / 4);
    for (let i = 0; i < note.length; i++) out[start + i] += note[i];
  }

  const quarterLen = stepLen * 2;
  for (let q = 0; q < steps / 2; q++) {
    const start = q * quarterLen;
    const note = pluck(quarterLen, rate, bass[q % bass.length], 0.24, quarterLen / rate / 4);
    for (let i = 0; i < note.length; i++) out[start + i] += note[i];
  }

  // Taper the very ends into each other so the wrap is silent.
  const edge = Math.floor(rate * 0.01);
  for (let i = 0; i < edge; i++) {
    const g = i / edge;
    out[i] *= g;
    out[n - 1 - i] *= g;
  }
  return out;
}

/** Pure PCM for one sound. Mono, in [-1, 1]. */
export function renderSound(name: SoundName, rate: number): Float32Array {
  switch (name) {
    case 'step': {
      const n = Math.floor(rate * 0.07);
      const rnd = noise(0x51ed11);
      const out = new Float32Array(n);
      for (let i = 0; i < n; i++) out[i] = rnd();
      lowpass(out, 0.09);
      for (let i = 0; i < n; i++) out[i] *= 0.55 * env(i, n, 0.02, 0.8);
      return out;
    }
    case 'jump':
      return tone(Math.floor(rate * 0.16), rate, 260, 660, 0.32, 0.25);
    case 'land': {
      const n = Math.floor(rate * 0.14);
      const rnd = noise(0x0dd1e5);
      const out = tone(n, rate, 180, 60, 0.3);
      const thump = new Float32Array(n);
      for (let i = 0; i < n; i++) thump[i] = rnd();
      lowpass(thump, 0.04);
      for (let i = 0; i < n; i++) out[i] = out[i] + thump[i] * 0.25 * env(i, n, 0.01, 0.9);
      return out;
    }
    case 'coin': {
      const n = Math.floor(rate * 0.22);
      const out = new Float32Array(n);
      const half = Math.floor(n / 3);
      const a = tone(half, rate, 988, 988, 0.28, 0.3);
      const b = tone(n - half, rate, 1319, 1319, 0.24, 0.3);
      out.set(a, 0);
      for (let i = 0; i < b.length; i++) out[half + i] += b[i];
      return out;
    }
    case 'stomp': {
      const n = Math.floor(rate * 0.18);
      const out = tone(n, rate, 420, 90, 0.3, 0.4);
      return out;
    }
    case 'hurt':
      return tone(Math.floor(rate * 0.3), rate, 400, 120, 0.34, 0.5);
    case 'goal': {
      const n = Math.floor(rate * 0.9);
      const out = new Float32Array(n);
      const notes = [523.25, 659.25, 783.99, 1046.5];
      const seg = Math.floor(n / notes.length);
      notes.forEach((f, k) => {
        const part = tone(n - k * seg, rate, f, f, 0.16, 0.3);
        for (let i = 0; i < part.length; i++) out[k * seg + i] += part[i];
      });
      for (let i = 0; i < n; i++) out[i] = Math.max(-1, Math.min(1, out[i]));
      return out;
    }
    case 'bed':
      return bed(rate);
    default:
      throw new Error(`renderSound: unknown sound "${name}"`);
  }
}

/**
 * Render every sound into the engine's context and hand back the handles.
 * Nothing is fetched — the demo ships no audio files.
 */
export function registerSounds(engine: AudioEngine): Record<SoundName, SoundHandle> {
  const rate = engine.context.sampleRate;
  const out = {} as Record<SoundName, SoundHandle>;
  for (const name of SOUND_NAMES) {
    const pcm = renderSound(name, rate);
    const buffer = engine.context.createBuffer(1, pcm.length, rate);
    buffer.getChannelData(0).set(pcm);
    out[name] = engine.register(buffer);
  }
  return out;
}
