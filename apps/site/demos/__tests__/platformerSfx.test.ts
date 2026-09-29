import { describe, it, expect, vi } from 'vitest';
import { toFrequency, type AudioEngine, type SoundHandle } from '@weasel-js/audio';
import {
  NOTE_SOUNDS, PCM_SOUND_NAMES, SOUND_NAMES, playSound, renderSound,
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

  it('fades every one-shot to silence so nothing clicks at the tail', () => {
    for (const name of PCM_SOUND_NAMES) {
      if (name === 'bed') continue;
      const pcm = renderSound(name, RATE);
      expect(Math.abs(pcm[pcm.length - 1]), `${name} tail`).toBeLessThan(0.02);
    }
  });

  it('makes the music bed loop seamlessly', () => {
    const pcm = renderSound('bed', RATE);
    // A seam is audible when the last sample and the first are far apart.
    expect(Math.abs(pcm[pcm.length - 1] - pcm[0])).toBeLessThan(0.05);
  });

  it('scales its length with the sample rate', () => {
    const a = renderSound('step', 22050);
    const b = renderSound('step', 44100);
    expect(b.length).toBeCloseTo(a.length * 2, -1);
  });

  it('rejects an unknown name', () => {
    expect(() => renderSound('nope' as PcmSoundName, RATE)).toThrow(/unknown sound/i);
  });
});

describe('note sounds', () => {
  it('covers every sound name exactly once between PCM and notes', () => {
    const notes = Object.keys(NOTE_SOUNDS);
    expect(new Set(SOUND_NAMES).size).toBe(SOUND_NAMES.length);
    expect([...PCM_SOUND_NAMES, ...notes].sort()).toEqual([...SOUND_NAMES].sort());
  });

  it('gives every note a playable pitch and a release', () => {
    for (const [name, notes] of Object.entries(NOTE_SOUNDS)) {
      for (const note of notes) {
        expect(toFrequency(note.pitch), name).toBeGreaterThan(20);
        expect(note.envelope?.release, name).toBeGreaterThan(0);
        expect(note.duration, name).toBeGreaterThan(0);
      }
    }
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
    const step = { id: 'snd_step' } as SoundHandle;
    const buffers = { step } as Record<PcmSoundName, SoundHandle>;
    playSound(engine as unknown as AudioEngine, buffers, 'step', { gain: 0.3 });
    expect(engine.play).toHaveBeenCalledWith(step, { gain: 0.3 });
  });
});
