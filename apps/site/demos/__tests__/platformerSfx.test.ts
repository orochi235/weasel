import { describe, it, expect, vi } from 'vitest';
import { toFrequency, type AudioEngine, type SoundHandle } from '@weasel-js/audio';
import {
  PCM_SOUND_NAMES, SOUND_NAMES, SYNTH_SOUNDS, playSound, renderSound,
  type PcmSoundName,
} from '../platformer/sfx';

const RATE = 44100;

describe('renderSound', () => {
  it('renders every PCM sound', () => {
    expect(PCM_SOUND_NAMES.length).toBeGreaterThan(0);
    for (const name of PCM_SOUND_NAMES) {
      const pcm = renderSound(name, RATE);
      expect(pcm.length, name).toBeGreaterThan(0);
      expect(pcm).toBeInstanceOf(Float32Array);
    }
  });

  it('stays inside the [-1, 1] range so nothing clips', () => {
    for (const name of PCM_SOUND_NAMES) {
      const pcm = renderSound(name, RATE);
      let peak = 0;
      for (let i = 0; i < pcm.length; i++) peak = Math.max(peak, Math.abs(pcm[i]));
      expect(peak, `${name} peak`).toBeLessThanOrEqual(1);
      expect(peak, `${name} is silent`).toBeGreaterThan(0.01);
    }
  });

  it('emits no NaN', () => {
    for (const name of PCM_SOUND_NAMES) {
      const pcm = renderSound(name, RATE);
      expect(pcm.some((v) => Number.isNaN(v)), name).toBe(false);
    }
  });

  it('makes the music bed loop seamlessly', () => {
    const pcm = renderSound('bed', RATE);
    // A seam is audible when the last sample and the first are far apart.
    expect(Math.abs(pcm[pcm.length - 1] - pcm[0])).toBeLessThan(0.05);
  });

  it('scales its length with the sample rate', () => {
    const a = renderSound('bed', 22050);
    const b = renderSound('bed', 44100);
    expect(b.length).toBeCloseTo(a.length * 2, -1);
  });

  it('rejects an unknown name', () => {
    expect(() => renderSound('nope' as PcmSoundName, RATE)).toThrow(/unknown sound/i);
  });
});

describe('synth sounds', () => {
  it('covers every sound name exactly once between PCM and synth voices', () => {
    const notes = Object.keys(SYNTH_SOUNDS);
    expect(new Set(SOUND_NAMES).size).toBe(SOUND_NAMES.length);
    expect([...PCM_SOUND_NAMES, ...notes].sort()).toEqual([...SOUND_NAMES].sort());
  });

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
    const buffers = {} as Record<PcmSoundName, SoundHandle>;
    playSound(engine as unknown as AudioEngine, buffers, 'step', { bus: 'sfx', gain: 0.5, when: 40 });
    expect(engine.playNoise).toHaveBeenCalledWith(expect.objectContaining({
      noise: 'brown', bus: 'sfx', when: 40, gain: expect.closeTo(0.33, 9),
    }));
    playSound(engine as unknown as AudioEngine, buffers, 'land');
    expect(engine.playNote).toHaveBeenCalledTimes(1);
    expect(engine.playNoise).toHaveBeenCalledTimes(2);
    expect(engine.play).not.toHaveBeenCalled();
  });

  it('books a synth sound as its notes, offset and scaled by the call', () => {
    const engine = { playNote: vi.fn(), play: vi.fn(), now: () => 100 };
    const buffers = {} as Record<PcmSoundName, SoundHandle>;
    playSound(engine as unknown as AudioEngine, buffers, 'coin', { bus: 'sfx', gain: 0.5 });
    expect(engine.play).not.toHaveBeenCalled();
    const booked = engine.playNote.mock.calls.map(([n]) => [n.when, n.gain, n.bus]);
    expect(booked).toEqual([[100, 0.14, 'sfx'], [173, 0.12, 'sfx']]);
  });

  it('plays a PCM sound as its buffer', () => {
    const engine = { playNote: vi.fn(), play: vi.fn(), now: () => 0 };
    const bed = { id: 'snd_bed' } as SoundHandle;
    const buffers = { bed } as Record<PcmSoundName, SoundHandle>;
    playSound(engine as unknown as AudioEngine, buffers, 'bed', { gain: 0.3 });
    expect(engine.play).toHaveBeenCalledWith(bed, { gain: 0.3 });
  });
});
