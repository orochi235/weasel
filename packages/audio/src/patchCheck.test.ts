import { describe, expect, it } from 'vitest';
import { biquadCoefficients } from './biquad';
import { createFilterEffect } from './effects';
import { createSynthStarters } from './synthStarters';
import { createNoiseKernel, createNoteKernel } from './voiceKernel';
import type { NoiseOptions, NoteOptions } from './types';

// Only `start` touches the context; every check here runs at the call.
const starters = createSynthStarters({} as BaseAudioContext, () => 0);

/** Each refuses the note on both voice paths: the kernel is what the worklet runs. */
const refusesNote = (note: NoteOptions): void => {
  expect(() => starters.note(note)).toThrow(RangeError);
  expect(() => createNoteKernel(note, 48000)).toThrow(RangeError);
};
const refusesNoise = (noise: NoiseOptions): void => {
  expect(() => starters.noise(noise)).toThrow(RangeError);
  expect(() => createNoiseKernel(noise, 48000)).toThrow(RangeError);
};

describe('synth patch name checks', () => {
  it('refuses a wave name outside the four built-ins, an inherited key included', () => {
    for (const wave of ['Sine', 'custom', 'toString', '__proto__']) {
      refusesNote({ pitch: 'A4', wave: wave as NoteOptions['wave'] });
    }
  });

  it('refuses a filter type the node does not have, wherever a filter is built', () => {
    const type = 'low-pass' as BiquadFilterType;
    refusesNote({ pitch: 'A4', filter: { type, frequency: 800 } });
    refusesNoise({ noise: 'white', filter: { type, frequency: 800 } });
    expect(() => biquadCoefficients(type, 800, 48000)).toThrow(RangeError);
    expect(() => createFilterEffect({} as BaseAudioContext, { type })).toThrow(RangeError);
    expect(() => biquadCoefficients('allpass', 800, 48000)).not.toThrow();
  });

  it('refuses a noise color outside white, pink, and brown', () => {
    refusesNoise({ noise: 'blue' as NoiseOptions['noise'] });
  });

  it('takes a patch whose numbers are all finite', () => {
    const note: NoteOptions = {
      pitch: 'A4', duration: 0, glide: { to: 'C5', ms: 0 },
      envelope: { attack: -1, sustain: 2 }, filter: { frequency: 800, Q: 2, amount: 50, envelope: {} },
    };
    expect(() => starters.note(note)).not.toThrow();
    expect(() => createNoteKernel(note, 48000)).not.toThrow();
  });
});
