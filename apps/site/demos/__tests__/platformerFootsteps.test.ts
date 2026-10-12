import { describe, it, expect } from 'vitest';
import { bindClip, type EventTrack } from '@weasel-js/animator';
import { CLIPS } from '../platformer/clips';
import { FOOTFALLS, FOOTSTEPS, STEP } from '../platformer/footsteps';

describe('FOOTSTEPS', () => {
  it('puts one footfall at each contact of the run cycle, and lasts one cycle', () => {
    expect(FOOTFALLS).toEqual([0, CLIPS.run.duration / 2]);
    expect(FOOTSTEPS.duration).toBe(CLIPS.run.duration);
    expect(JSON.parse(JSON.stringify(FOOTSTEPS))).toEqual(FOOTSTEPS);
  });

  it('binds to an event track that books each footfall and hands back its handle', () => {
    const booked: number[] = [];
    const voice = { stop: () => {} };
    const live = bindClip(FOOTSTEPS, { event: (name) => (name === STEP ? { book: (when) => { booked.push(when); return voice; } } : undefined) });
    const track = live.tracks[0] as EventTrack;
    expect(track.events.map((e) => e.t)).toEqual(FOOTFALLS);
    expect(track.events[1].book?.(1234)).toBe(voice);
    expect(booked).toEqual([1234]);
  });
});
