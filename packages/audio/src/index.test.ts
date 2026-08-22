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

  it('does not export the test double', () => {
    expect('createFakeAudioContext' in audio).toBe(false);
  });
});
