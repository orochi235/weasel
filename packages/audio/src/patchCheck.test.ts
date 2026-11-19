import { describe, expect, it } from 'vitest';
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

describe('synth patch checks', () => {
  it('refuses a duration that is not a finite number of ms, 0 or more', () => {
    for (const duration of [NaN, Infinity, -1]) {
      refusesNote({ pitch: 'A4', duration });
      refusesNoise({ noise: 'white', duration });
    }
  });

  it('refuses an envelope time or sustain that is not finite', () => {
    for (const key of ['attack', 'decay', 'sustain', 'release'] as const) {
      refusesNote({ pitch: 'A4', duration: 100, envelope: { [key]: NaN } });
      refusesNoise({ noise: 'pink', duration: 100, envelope: { [key]: Infinity } });
    }
  });

  it('refuses a filter number that is not finite, its envelope included', () => {
    refusesNote({ pitch: 'A4', filter: { frequency: NaN } });
    refusesNote({ pitch: 'A4', filter: { frequency: 800, Q: Infinity } });
    refusesNote({ pitch: 'A4', filter: { frequency: 800, gain: NaN } });
    refusesNote({ pitch: 'A4', filter: { frequency: 800, amount: NaN, envelope: {} } });
    refusesNoise({ noise: 'white', filter: { frequency: 800, amount: 100, envelope: { decay: NaN } } });
  });

  it('refuses a glide time that is not a finite number of ms', () => {
    refusesNote({ pitch: 'A4', glide: { to: 'C5', ms: NaN } });
    refusesNote({ pitch: 'A4', glide: { to: 'C5', ms: -5 } });
  });

  it('refuses a partial gain that is not finite', () => {
    refusesNote({ pitch: 'A4', wave: { partials: [{ ratio: 1, gain: NaN }, { ratio: 2 }] } });
    refusesNote({ pitch: 'A4', wave: { partials: [{ ratio: 1, gain: Infinity }] } });
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
