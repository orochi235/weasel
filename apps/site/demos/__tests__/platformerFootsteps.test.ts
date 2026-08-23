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
    track.events.forEach((e) => e.fire());
    expect(fired).toEqual(FOOTFALLS);
  });

  it('hands the handler the authored time, which is all `fire()` can carry', () => {
    const seen: number[] = [];
    const track = footstepTrack((t) => seen.push(t));
    track.events[1].fire();
    // The authored `t`, not the crossing time — `fire()` takes no argument, so
    // the real playhead is unreachable from here. See docs/TODO.md.
    expect(seen).toEqual([CLIPS.run.duration / 2]);
  });
});
