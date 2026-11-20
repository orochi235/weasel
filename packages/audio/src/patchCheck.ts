import { checkFinite } from './param';
import type { NoiseColor, Waveform } from './types';

const fail = (message: string): never => {
  throw new RangeError(`@weasel-js/audio: ${message}`);
};

const WAVE_NAMES = new Set<string>(['sine', 'square', 'sawtooth', 'triangle']);

/** Throws on a named or harmonic wave neither voice path could play.
 *  Inharmonic partials are checked by `resolvePartials`. */
export function checkWave(wave: Waveform): void {
  if (typeof wave === 'string') {
    if (!WAVE_NAMES.has(wave)) fail(`"${wave}" is not a wave: one of sine, square, sawtooth, triangle`);
  } else if (Array.isArray(wave)) {
    const levels = wave as readonly number[];
    if (levels.length === 0) fail('a harmonic wave needs at least one level');
    for (const level of levels) checkFinite('harmonic level', level);
  }
}

const FILTER_TYPES = new Set<string>([
  'lowpass', 'highpass', 'bandpass', 'lowshelf', 'highshelf', 'peaking', 'notch', 'allpass',
]);

/** Throws on a filter type a `BiquadFilterNode` would ignore and the kernel would run as something else. */
export function checkFilterType(type: string): void {
  if (!FILTER_TYPES.has(type)) fail(`"${type}" is not a filter type`);
}

const NOISE_COLORS = new Set<string>(['white', 'pink', 'brown']);

/** Throws on a noise color there is no buffer for. */
export function checkNoiseColor(color: NoiseColor): void {
  if (!NOISE_COLORS.has(color)) fail(`"${color}" is not a noise color: one of white, pink, brown`);
}
