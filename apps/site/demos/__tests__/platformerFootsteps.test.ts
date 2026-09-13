import { describe, it, expect } from 'vitest';
import { CLIPS } from '../platformer/clips';
import { FOOTFALLS, footstepTrack } from '../platformer/footsteps';

describe('footstepTrack', () => {
  it('puts one footfall at each contact of the run cycle', () => {
    expect(FOOTFALLS).toEqual([0, CLIPS.run.duration / 2]);
  });

  it('builds an event track that books each footfall', () => {
    const booked: number[] = [];
    const track = footstepTrack((t) => { booked.push(t); });
    expect(track.kind).toBe('event');
    expect(track.events).toHaveLength(2);
    track.events.forEach((e) => e.book?.(0));
    expect(booked).toEqual(FOOTFALLS);
  });

  it('hands the handler which contact it is and when it lands, and returns its handle', () => {
    const seen: [number, number][] = [];
    const voice = { stop: () => {} };
    const track = footstepTrack((t, when) => { seen.push([t, when]); return voice; });
    expect(track.events[1].book?.(1234)).toBe(voice);
    expect(seen).toEqual([[CLIPS.run.duration / 2, 1234]]);
  });
});
