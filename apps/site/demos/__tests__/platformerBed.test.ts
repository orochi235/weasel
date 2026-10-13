import { describe, it, expect } from 'vitest';
import { patternVoicePeaks } from '@weasel-js/audio';
import { BED_BUS, BED_STEPS, BED_TEMPO, bedDetune, bedEvents } from '../platformer/bed';
import { VOICE_LIMIT } from '../platformer/usePlatformerAudio';

const drift = bedDetune as (step: number) => number;

describe('the music bed as pattern events', () => {
  const events = bedEvents();

  it('keeps every event inside the loop, so the player books all of them', () => {
    const steps = events.map((e) => Math.floor(e.step));
    expect(Math.min(...steps)).toBe(0);
    expect(Math.max(...steps)).toBeLessThan(BED_STEPS);
  });

  it('plays everything on the music bus, at a gain a voice can take', () => {
    expect(new Set(events.map((e) => e.bus))).toEqual(new Set([BED_BUS]));
    for (const e of events) {
      expect(e.gain).toBeGreaterThan(0);
      expect(e.gain).toBeLessThanOrEqual(1);
    }
  });

  it('fits its busiest moment inside the engine voice limit', () => {
    const peaks = patternVoicePeaks(events, { tempo: BED_TEMPO, length: BED_STEPS, bus: BED_BUS });
    expect(peaks[BED_BUS]).toBeLessThanOrEqual(VOICE_LIMIT);
  });

  it('lands no two hits of one bar equally late', () => {
    const lates = events
      .filter((e) => 'pitch' in e && e.pitch === 52 * 2.4)
      .map((e) => e.step - Math.floor(e.step));
    expect(lates.length).toBeGreaterThan(8);
    expect(new Set(lates).size).toBe(lates.length);
    expect(Math.max(...lates)).toBeLessThan(0.22);
  });

  it('drifts a few cents sharp and back, in tune where the loop wraps', () => {
    expect(drift(0)).toBeCloseTo(0, 9);
    expect(drift(BED_STEPS)).toBeCloseTo(0, 9);
    expect(drift(BED_STEPS / 4)).toBeCloseTo(13.8, 1);
    expect(drift((BED_STEPS * 3) / 4)).toBeCloseTo(-13.9, 1);
  });

  it('is the same arrangement every time', () => {
    expect(bedEvents()).toEqual(events);
  });
});
