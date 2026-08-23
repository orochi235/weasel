import { describe, it, expect } from 'vitest';
import { SOUND_NAMES, renderSound, type SoundName } from '../platformer/sfx';

const RATE = 44100;

describe('renderSound', () => {
  it('renders every named sound', () => {
    expect(SOUND_NAMES.length).toBeGreaterThan(0);
    for (const name of SOUND_NAMES) {
      const pcm = renderSound(name, RATE);
      expect(pcm.length, name).toBeGreaterThan(0);
      expect(pcm).toBeInstanceOf(Float32Array);
    }
  });

  it('stays inside the [-1, 1] range so nothing clips', () => {
    for (const name of SOUND_NAMES) {
      const pcm = renderSound(name, RATE);
      let peak = 0;
      for (let i = 0; i < pcm.length; i++) peak = Math.max(peak, Math.abs(pcm[i]));
      expect(peak, `${name} peak`).toBeLessThanOrEqual(1);
      expect(peak, `${name} is silent`).toBeGreaterThan(0.01);
    }
  });

  it('emits no NaN', () => {
    for (const name of SOUND_NAMES) {
      const pcm = renderSound(name, RATE);
      expect(pcm.some((v) => Number.isNaN(v)), name).toBe(false);
    }
  });

  it('fades every one-shot to silence so nothing clicks at the tail', () => {
    for (const name of SOUND_NAMES) {
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
    const a = renderSound('coin', 22050);
    const b = renderSound('coin', 44100);
    expect(b.length).toBeCloseTo(a.length * 2, -1);
  });

  it('rejects an unknown name', () => {
    expect(() => renderSound('nope' as SoundName, RATE)).toThrow(/unknown sound/i);
  });
});
