import { createPart } from '@weasel-js/registry';
import { toUnitPeak } from './oscillator';

/** Waves kept per context. A timbre morphed note by note mints a wave per note, and
 *  an oscillator keeps the wave it was given, so one dropped here costs only a rebuild. */
export const PERIODIC_WAVE_CACHE = 64;

const wavesIn = createPart((_ctx: BaseAudioContext) => new Map<string, PeriodicWave>());

/** A wave of sines, partial k at amplitude `partials[k - 1]`, shared by every call with the
 *  same levels in proportion, up to the {@link PERIODIC_WAVE_CACHE} most recently asked for. */
export function periodicWave(ctx: BaseAudioContext, partials: readonly number[]): PeriodicWave {
  const byKey = wavesIn(ctx);
  // Scaled first: a level past float32's range would store as Infinity, and one below it as 0.
  const levels = toUnitPeak(partials);
  const key = levels.join(',');
  let wave = byKey.get(key);
  if (wave) {
    byKey.delete(key);
  } else {
    // Sine terms only: partial k sits at imag[k], and index 0 is the DC term.
    const imag = new Float32Array(levels.length + 1);
    imag.set(levels, 1);
    wave = ctx.createPeriodicWave(new Float32Array(levels.length + 1), imag);
    if (byKey.size >= PERIODIC_WAVE_CACHE) byKey.delete(byKey.keys().next().value!);
  }
  byKey.set(key, wave);
  return wave;
}
