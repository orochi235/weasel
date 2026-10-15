import type { Inharmonic, Waveform } from './types';

/** One cycle of a wave: its value at `phase` (0..1) when a sample advances it
 *  by `dt` cycles. `dt` is how a shape knows what would land past Nyquist. */
export type WaveShape = (phase: number, dt: number) => number;

const TAU = 2 * Math.PI;
/** Points a harmonic wave is measured at to find its peak. */
const PEAK_POINTS = 4096;

/** Cycles a sample above which a triangle is summed from its odd harmonics.
 *  Below it the plain shape's first folded harmonic is its 65th, 72 dB down. */
const TRIANGLE_SUMMED_FROM = 1 / 128;

/** The correction that rounds a unit step at `t = 0` over the sample either
 *  side of it, which is what keeps a square or a sawtooth from aliasing. */
function polyBlep(t: number, dt: number): number {
  const d = Math.min(dt, 0.5);
  if (t < d) {
    const x = t / d;
    return x + x - x * x - 1;
  }
  if (t > 1 - d) {
    const x = (t - 1) / d;
    return x * x + x + x + 1;
  }
  return 0;
}

export const sineShape: WaveShape = (phase) => Math.sin(TAU * phase);

/** The level an `OscillatorNode` plays a square or a sawtooth at. Its table is the Fourier sum
 *  scaled so the overshoot beside each step peaks at 1, which leaves the flat at 1 / 1.17898. */
const STEPPED_LEVEL = 1 / 1.17898;

/** Each starts at zero, rising, as the `OscillatorNode` types do. */
const BUILT_IN: Record<'sine' | 'square' | 'sawtooth' | 'triangle', WaveShape> = {
  sine: sineShape,
  square: (phase, dt) => STEPPED_LEVEL * ((phase < 0.5 ? 1 : -1) + polyBlep(phase, dt) - polyBlep((phase + 0.5) % 1, dt)),
  sawtooth: (phase, dt) => {
    const t = (phase + 0.5) % 1;
    return STEPPED_LEVEL * (2 * t - 1 - polyBlep(t, dt));
  },
  triangle: (phase, dt) => {
    if (dt < TRIANGLE_SUMMED_FROM) return phase < 0.25 ? 4 * phase : phase < 0.75 ? 2 - 4 * phase : 4 * phase - 4;
    let v = 0;
    let sign = 1;
    for (let k = 1; k * dt < 0.5; k += 2) {
      v += (sign * Math.sin(TAU * k * phase)) / (k * k);
      sign = -sign;
    }
    return (v * 8) / (Math.PI * Math.PI);
  },
};

/** Sine harmonics at `levels`, the fundamental first, scaled so the whole wave
 *  peaks at 1 as a `PeriodicWave` is. A harmonic at or past Nyquist is left out. */
function harmonicShape(levels: readonly number[]): WaveShape {
  const sum = (phase: number, count: number): number => {
    let v = 0;
    for (let k = 1; k <= count; k += 1) v += levels[k - 1] * Math.sin(TAU * k * phase);
    return v;
  };
  let peak = 0;
  for (let i = 0; i < PEAK_POINTS; i += 1) peak = Math.max(peak, Math.abs(sum(i / PEAK_POINTS, levels.length)));
  const scale = peak > 0 ? 1 / peak : 0;
  return (phase, dt) => scale * sum(phase, Math.min(levels.length, Math.ceil(0.5 / dt) - 1));
}

/** The shape of a wave an oscillator plays at one pitch. */
export function waveShape(wave: Exclude<Waveform, Inharmonic>): WaveShape {
  return typeof wave === 'string' ? BUILT_IN[wave] : harmonicShape(wave);
}
