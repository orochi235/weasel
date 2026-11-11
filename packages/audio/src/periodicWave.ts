import { toUnitPeak } from './oscillator';

const cache = new WeakMap<BaseAudioContext, Map<string, PeriodicWave>>();

/** A wave of sines, partial k at amplitude `partials[k - 1]`, made once per context. */
export function periodicWave(ctx: BaseAudioContext, partials: readonly number[]): PeriodicWave {
  let byKey = cache.get(ctx);
  if (!byKey) {
    byKey = new Map();
    cache.set(ctx, byKey);
  }
  const key = partials.join(',');
  let wave = byKey.get(key);
  if (!wave) {
    // Sine terms only: partial k sits at imag[k], and index 0 is the DC term.
    const imag = new Float32Array(partials.length + 1);
    // Scaled first: a level past float32's range would store as Infinity, and one below it as 0.
    imag.set(toUnitPeak(partials), 1);
    wave = ctx.createPeriodicWave(new Float32Array(partials.length + 1), imag);
    byKey.set(key, wave);
  }
  return wave;
}
