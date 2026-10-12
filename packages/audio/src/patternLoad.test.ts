import { describe, expect, it } from 'vitest';
import { patternVoicePeaks } from './patternLoad';

// 120 bpm in sixteenths: 125 ms a step. No lookahead unless a test sets one.
const base = { tempo: 120, lookahead: 0 };

describe('patternVoicePeaks', () => {
  it('counts the voices sounding at once on each bus', () => {
    const peaks = patternVoicePeaks([
      { step: 0, length: 4, pitch: 220, bus: 'music' },
      { step: 1, length: 1, pitch: 330, bus: 'music' },
      { step: 3, length: 1, pitch: 440, bus: 'music' },
      { step: 2, noise: 'white', bus: 'sfx' },
    ], { ...base, loop: false });
    expect(peaks).toEqual({ music: 2, sfx: 1 });
  });

  it('holds a note through its release', () => {
    const events = [
      { step: 0, pitch: 220, envelope: { release: 200 } },
      { step: 1, pitch: 220, envelope: { release: 200 } },
      { step: 2, pitch: 220, envelope: { release: 200 } },
    ];
    expect(patternVoicePeaks(events, { ...base, loop: false })).toEqual({ sfx: 3 });
    expect(patternVoicePeaks(events.map((e) => ({ ...e, envelope: { release: 0 } })), { ...base, loop: false }))
      .toEqual({ sfx: 1 });
  });

  it('wraps a tail into the next pass of a loop', () => {
    const events = [
      { step: 0, pitch: 220, envelope: { release: 0 } },
      { step: 3, length: 3, pitch: 220, envelope: { release: 0 } },
    ];
    expect(patternVoicePeaks(events, { ...base, length: 4, loop: false })).toEqual({ sfx: 1 });
    expect(patternVoicePeaks(events, { ...base, length: 4 })).toEqual({ sfx: 2 });
  });

  it('sets a short event against every pass a long one still rings from', () => {
    const events = [
      { step: 0, length: 9, pitch: 220, envelope: { release: 0 } },
      { step: 0, pitch: 330, envelope: { release: 0 } },
    ];
    expect(patternVoicePeaks(events, { ...base, length: 4 })).toEqual({ sfx: 4 });
  });

  it('counts a voice from when its slot is taken, a lookahead before it sounds', () => {
    const events = [
      { step: 0, pitch: 220, envelope: { release: 0 } },
      { step: 1, pitch: 220, envelope: { release: 0 } },
    ];
    expect(patternVoicePeaks(events, { ...base, loop: false })).toEqual({ sfx: 1 });
    expect(patternVoicePeaks(events, { tempo: 120, loop: false })).toEqual({ sfx: 2 });
  });

  it('places a fractional step where the player does', () => {
    const events = [
      { step: 0, pitch: 220, envelope: { release: 0 } },
      { step: 0.5, pitch: 220, envelope: { release: 0 } },
    ];
    expect(patternVoicePeaks(events, { ...base, loop: false })).toEqual({ sfx: 2 });
  });

  it('asks how long a buffer hit sounds, and takes one step when not told', () => {
    const sound = { id: 'snd_1' };
    const events = [{ step: 0, sound }, { step: 1, sound }, { step: 2, sound }];
    expect(patternVoicePeaks(events, { ...base, loop: false })).toEqual({ sfx: 1 });
    expect(patternVoicePeaks(events, { ...base, loop: false, hitMs: () => 300 })).toEqual({ sfx: 3 });
  });

  it('files an event with no bus under the one it is told', () => {
    expect(patternVoicePeaks([{ step: 0, pitch: 220 }], { ...base, bus: 'music' })).toEqual({ music: 1 });
  });
});
