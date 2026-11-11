import { describe, expect, it } from 'vitest';
import { patternVoicePeaks } from './patternLoad';

describe('patternVoicePeaks, shrunk from the property tests', () => {
  it('leaves out an event on a step past the pass, which the player never plays', () => {
    const hit = { id: 'snd_1' };
    const events = [{ step: 2, sound: hit, bus: 'music' }, { step: 0, sound: hit, bus: 'music' }];
    expect(patternVoicePeaks(events, { tempo: 60, stepsPerBeat: 1, length: 1, loop: true, lookahead: 1 })).toEqual({ music: 2 });
  });
});
