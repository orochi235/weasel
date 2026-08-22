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
