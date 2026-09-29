import { describe, expect, it } from 'vitest';
import * as audio from '@weasel-js/audio';

describe('@weasel-js/audio public surface', () => {
  it('exports the engine factory', () => {
    expect(typeof audio.createAudioEngine).toBe('function');
  });

  it('exports the pure helpers so they are usable without an engine', () => {
    expect(typeof audio.spatialize).toBe('function');
    expect(typeof audio.createVoicePool).toBe('function');
    expect(typeof audio.createScheduler).toBe('function');
    expect(typeof audio.createTickTimer).toBe('function');
  });

  it('exports the note layer: pitch, envelope and the pattern player', () => {
    expect(audio.toFrequency('A4')).toBe(440);
    expect(audio.midiToFrequency(69)).toBe(440);
    expect(audio.noteToMidi('C4')).toBe(60);
    expect(typeof audio.envelopeLevel).toBe('function');
    expect(typeof audio.createPatternPlayer).toBe('function');
    const note: audio.NoteOptions = { pitch: { midi: 60 }, wave: [1, 0.5], envelope: { attack: 2 } };
    const event: audio.PatternEvent = { step: 0, ...note };
    expect(event.step).toBe(0);
  });

  it('exports the noise and inharmonic voice surface', () => {
    expect(audio.noiseSamples('pink', 64)).toHaveLength(64);
    const bell: audio.Inharmonic = audio.partialPresets.bell;
    const filter: audio.VoiceFilter = { frequency: 200, amount: 800, envelope: { decay: 40, sustain: 0 } };
    const hiss: audio.NoiseOptions = { noise: 'white', filter };
    const hat: audio.PatternEvent = { step: 2, ...hiss, length: 1 };
    const partial: audio.SynthPartial = bell.partials[0];
    expect([hat.step, partial.ratio > 0]).toEqual([2, true]);
  });

  it('exports the built-in insert effects', () => {
    expect(typeof audio.createFilterEffect).toBe('function');
    expect(typeof audio.createReverbEffect).toBe('function');
    expect(typeof audio.createDelayEffect).toBe('function');
    expect(typeof audio.createCompressorEffect).toBe('function');
    const opts: audio.StreamOptions = { bus: 'music', offset: 0 };
    expect(opts.offset).toBe(0);
  });

  it('names the option and record types a pool consumer has to write down', () => {
    // Types erase, so this is a compile-time assertion: the names must resolve.
    const opts: audio.VoicePoolOptions = { limit: 2, steal: 'quietest' };
    const record: audio.VoiceRecord = { startedAt: 0, gain: 1 };
    const got: audio.Acquisition = audio.createVoicePool(opts).acquire(record);
    expect(got.slot).toBe(0);
  });

  it('does not export the test double', () => {
    expect('createFakeAudioContext' in audio).toBe(false);
  });
});
