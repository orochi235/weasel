import { describe, it, expect } from 'vitest';
import { CLIPS } from '../platformer/clips';
import { FOOTFALLS, footstepTrack } from '../platformer/footsteps';

describe('footstepTrack', () => {
  it('puts one footfall at each contact of the run cycle', () => {
    expect(FOOTFALLS).toEqual([0, CLIPS.run.duration / 2]);
  });

  it('builds an event track that fires each footfall', () => {
    const fired: number[] = [];
    const track = footstepTrack((t) => fired.push(t));
    expect(track.kind).toBe('event');
    expect(track.events).toHaveLength(2);
    track.events.forEach((e) => e.fire(0));
    expect(fired).toEqual(FOOTFALLS);
  });

  it('hands the handler which contact it is and how stale the crossing is', () => {
    const seen: [number, number][] = [];
    const track = footstepTrack((t, lateBy) => seen.push([t, lateBy]));
    track.events[1].fire(7);
    expect(seen).toEqual([[CLIPS.run.duration / 2, 7]]);
  });
});
