import { describe, it, expect, vi } from 'vitest';
import { toFrequency, type AudioEngine } from '@weasel-js/audio';
import { SYNTH_SOUNDS, playSound } from '../platformer/sfx';

describe('synth sounds', () => {
  it('gives every voice a gate and a release, and every note a playable pitch', () => {
    for (const [name, voices] of Object.entries(SYNTH_SOUNDS)) {
      for (const voice of voices) {
        if ('pitch' in voice) expect(toFrequency(voice.pitch), name).toBeGreaterThan(20);
        expect(voice.envelope?.release, name).toBeGreaterThan(0);
        expect(voice.duration, name).toBeGreaterThan(0);
      }
    }
  });

  it('books a noise voice through playNoise, and a mixed sound as both', () => {
    const engine = { playNote: vi.fn(), playNoise: vi.fn(), play: vi.fn(), now: () => 0 };
    playSound(engine as unknown as AudioEngine, 'step', { bus: 'sfx', gain: 0.5, when: 40 });
    expect(engine.playNoise).toHaveBeenCalledWith(expect.objectContaining({
      noise: 'brown', bus: 'sfx', when: 40, gain: expect.closeTo(0.33, 9),
    }));
    playSound(engine as unknown as AudioEngine, 'land');
    expect(engine.playNote).toHaveBeenCalledTimes(1);
    expect(engine.playNoise).toHaveBeenCalledTimes(2);
    expect(engine.play).not.toHaveBeenCalled();
  });

  it('books a synth sound as its notes, offset and scaled by the call', () => {
    const engine = { playNote: vi.fn(), play: vi.fn(), now: () => 100 };
    playSound(engine as unknown as AudioEngine, 'coin', { bus: 'sfx', gain: 0.5 });
    expect(engine.play).not.toHaveBeenCalled();
    const booked = engine.playNote.mock.calls.map(([n]) => [n.when, n.gain, n.bus]);
    expect(booked).toEqual([[100, 0.14, 'sfx'], [173, 0.12, 'sfx']]);
  });
});
