import { createPart } from '@weasel-js/registry';
import { toUnitPeak } from './oscillator';

const wavesIn = createPart((_ctx: BaseAudioContext) => new Map<string, PeriodicWave>());

/** A wave of sines, partial k at amplitude `partials[k - 1]`, made once per context. */
export function periodicWave(ctx: BaseAudioContext, partials: readonly number[]): PeriodicWave {
  const byKey = wavesIn(ctx);
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
