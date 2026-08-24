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

/** Sum of the first few harmonics at 1/k — a rough saw, which is what makes a
 *  power chord read as a guitar rather than a sine. */
function saw(freq: number, t: number, partials = 6): number {
  let v = 0;
  for (let k = 1; k <= partials; k++) v += Math.sin(2 * Math.PI * freq * k * t) / k;
  return v * 0.5;
}

/** A palm-muted power chord: root, fifth, octave, fast attack, short decay. */
function chug(n: number, rate: number, root: number, gain: number, decay: number): Float32Array {
  const out = new Float32Array(n);
  const attack = Math.max(1, Math.floor(rate * 0.003));
  for (let i = 0; i < n; i++) {
    const t = i / rate;
    const a = i < attack ? i / attack : 1;
    const v = saw(root, t) + 0.8 * saw(root * 1.5, t) + 0.45 * saw(root * 2, t);
    out[i] = v * gain * a * Math.exp(-t / decay);
  }
  lowpass(out, 0.4);
  return out;
}

function bassNote(n: number, rate: number, freq: number, gain: number): Float32Array {
  const out = new Float32Array(n);
  const attack = Math.max(1, Math.floor(rate * 0.004));
  for (let i = 0; i < n; i++) {
    const t = i / rate;
    const a = i < attack ? i / attack : 1;
    out[i] = (Math.sin(2 * Math.PI * freq * t) + 0.3 * saw(freq, t, 3)) * gain * a * Math.exp(-t / 0.19);
  }
  return out;
}

/** Partial ratios well off the harmonic series. This is the whole trick behind
 *  "metal": a bell or a string lands near integers, struck junk does not. */
const CLANK_RATIOS = [1, 1.71, 2.43, 3.19, 4.61, 5.87];

function clank(n: number, rate: number, freq: number, gain: number, decay: number, seed: number): Float32Array {
  const out = new Float32Array(n);
  const rnd = noise(seed);
  const strike = Math.min(n, Math.floor(rate * 0.004));
  for (let i = 0; i < strike; i++) out[i] += rnd() * gain * 1.1;
  for (let p = 0; p < CLANK_RATIOS.length; p++) {
    const f = freq * CLANK_RATIOS[p] * (1 + rnd() * 0.012);
    const a = gain / (1 + p * 0.9);
    const d = decay / (1 + p * 0.35);
    for (let i = 0; i < n; i++) {
      const t = i / rate;
      out[i] += Math.sin(2 * Math.PI * f * t) * a * Math.exp(-t / d);
    }
  }
  lowpass(out, 0.6);
  return out;
}

/** An empty oil drum: boxy pitch-drop with a metallic ring sitting on top. */
function drum(n: number, rate: number, freq: number, gain: number, seed: number): Float32Array {
  const out = new Float32Array(n);
  let phase = 0;
  for (let i = 0; i < n; i++) {
    const t = i / rate;
    phase += (2 * Math.PI * (freq * (1 + 1.4 * Math.exp(-t / 0.012)))) / rate;
    out[i] = Math.sin(phase) * gain * Math.exp(-t / 0.15);
  }
  const ring = clank(n, rate, freq * 4.3, gain * 0.18, 0.1, seed);
  for (let i = 0; i < n; i++) out[i] += ring[i];
  return out;
}

/** Chain rattle standing in for a hi-hat: a few tiny tings scattered across
 *  the slot rather than one clean tick. */
function rattle(n: number, rate: number, gain: number, seed: number): Float32Array {
  const out = new Float32Array(n);
  const rnd = noise(seed);
  for (let k = 0; k < 4; k++) {
    const at = Math.floor(Math.abs(rnd()) * n * 0.6);
    const len = Math.min(n - at, Math.floor(rate * 0.045));
    if (len <= 0) continue;
    const ting = clank(len, rate, 2200 + Math.abs(rnd()) * 2000, gain, 0.018, seed + k * 17);
    for (let i = 0; i < ting.length; i++) out[at + i] += ting[i];
  }
  return out;
}

const BPM = 146;
/** I–V–vi–IV, one bar each — the roots the old bed used. */
const BED_ROOTS = [65.41, 98.0, 110.0, 87.31]; // C2 G2 A2 F2
/** C major, one degree per digit, starting at C5. Index 0 is unused. */
const SCALE = [0, 523.25, 587.33, 659.25, 698.46, 783.99, 880.0, 987.77, 1046.5];

/**
 * One row per bar, sixteen sixteenth-note slots each, `x` for a hit. Four
 * different bars rather than one repeated four times — a loop this short reads
 * as a loop the moment two bars match.
 */
const PATTERN = {
  drum:  ['x.....x...x.....', 'x.....x...x...x.', 'x..x..x...x.....', 'x.....x...x.x.x.'],
  lid:   ['....x.......x...', '....x.....x.x...', '....x.......x..x', '....x.......x.x.'],
  chain: ['x.x.x.x.x.x.x.x.', 'x.x.x.xxx.x.x.x.', 'x.x.x.x.x.x.xxx.', 'xxxxx.x.xxxxxxxx'],
  /** Off-beat upstrokes. The skank is most of the bounce. */
  skank: ['..x...x...x...x.', '..x...x...x.x.x.', '..x.x.x...x...x.', '..x...x.x.x.....'],
  /** Downstroke power chords, pushed off the beat everywhere but the downbeat. */
  chug:  ['x..x......x.....', 'x..x..x.........', 'x.....x..x......', 'x..x......x.x...'],
  /** Scale degrees for the lead; two bars carry it, two leave air. */
  lead:  ['................', '5.6.5.3.....1...', '................', '..3.5.6.8.6.5.3.'],
} as const;

/** How late a hit can land, as a fraction of a sixteenth. Every hit drags a
 *  little and none of them drags the same amount — this is the drunk. */
const DRAG = 0.22;
/** Pitch wander depth. One full cycle per loop, so the wrap stays in tune. */
const WOBBLE = 0.008;

/**
 * Four bars at 146 bpm played on junk: oil drums, a trash-can lid, chain for a
 * hi-hat, and pipes for the fill, under root-note bass and off-beat power
 * chords. Every hit is nudged late by its own amount and the whole thing drifts
 * a few cents sharp and back across the loop. Peak-normalized and tapered at
 * both ends so the wrap is inaudible.
 */
function bed(rate: number): Float32Array {
  const sixteenth = Math.floor((rate * (60 / BPM)) / 4);
  const bars = BED_ROOTS.length;
  const n = sixteenth * 16 * bars;
  const out = new Float32Array(n);

  const mix = (src: Float32Array, at: number) => {
    const start = Math.max(0, Math.min(at, n - 1));
    const end = Math.min(src.length, n - start);
    for (let i = 0; i < end; i++) out[start + i] += src[i];
  };
  /** Same slot, same drag, every render — but no two slots alike. */
  const drag = (bar: number, k: number) =>
    Math.floor(((Math.sin(bar * 12.9898 + k * 78.233) * 43758.5453) % 1 + 1) % 1 * DRAG * sixteenth);
  const wobble = (at: number) => 1 + WOBBLE * Math.sin((2 * Math.PI * at) / n);

  for (let bar = 0; bar < bars; bar++) {
    const root = BED_ROOTS[bar];
    for (let k = 0; k < 16; k++) {
      const slot = (bar * 16 + k) * sixteenth;
      const at = slot + drag(bar, k);
      const tune = wobble(at);
      const seed = 0x51a2 + bar * 131 + k * 7;

      if (PATTERN.drum[bar][k] === 'x') mix(drum(sixteenth * 5, rate, 52 * tune, 0.42, seed), at);
      if (PATTERN.lid[bar][k] === 'x') mix(clank(sixteenth * 6, rate, 310 * tune, 0.16, 0.11, seed), at);
      if (PATTERN.chain[bar][k] === 'x') mix(rattle(sixteenth * 2, rate, k % 4 === 0 ? 0.05 : 0.032, seed), at);
      if (PATTERN.skank[bar][k] === 'x') mix(chug(sixteenth * 3, rate, root * 2 * tune, 0.07, 0.09), at);
      if (PATTERN.chug[bar][k] === 'x') mix(chug(sixteenth * 5, rate, root * tune, 0.11, 0.2), at);

      // The lead is struck metal too, and tuned slightly flat against the chords.
      const deg = PATTERN.lead[bar][k];
      if (deg !== '.') mix(clank(sixteenth * 5, rate, SCALE[Number(deg)] * 0.997 * tune, 0.05, 0.13, seed), at);

      if (k % 2 === 0) {
        const octave = k % 4 === 2 ? 2 : 1;
        const walk = bar === 3 && k >= 12 ? 1.5 : 1;
        mix(bassNote(sixteenth * 3, rate, root * octave * walk * tune, 0.3), at);
      }
    }
  }

  // Four pipes of falling pitch over the last beat, handing the loop back to
  // bar one instead of just stopping.
  [430, 360, 305, 255].forEach((f, i) => {
    const k = 12 + i;
    mix(clank(sixteenth * 4, rate, f, 0.13, 0.14, 0x9111 + i), ((bars - 1) * 16 + k) * sixteenth + drag(bars - 1, k));
  });

  let peak = 0;
  for (let i = 0; i < n; i++) peak = Math.max(peak, Math.abs(out[i]));
  const norm = peak > 0 ? 0.88 / peak : 1;
  for (let i = 0; i < n; i++) out[i] *= norm;

  const edge = Math.floor(rate * 0.006);
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
