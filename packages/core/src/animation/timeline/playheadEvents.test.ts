import { describe, expect, it } from 'vitest';
import { makeTimeline } from './createTimeline.test-harness';
import type { EventTrack, Track } from './types';

const track = (fired: string[], times: number[]): EventTrack => ({
  kind: 'event',
  events: times.map((t) => ({ t, fire: () => fired.push(`@${t}`) })),
});

describe('an event under the playhead', () => {
  it('stays silent while a timeline created paused sits on it', () => {
    const fired: string[] = [];
    const tl = makeTimeline({ duration: 100, autoplay: false, tracks: [track(fired, [0])] });
    tl.advance(0);
    tl.advance(0);
    expect(fired).toEqual([]);
    tl.handle.resume();
    tl.advance(0);
    expect(fired).toEqual(['@0']);
  });

  it('fires when playback resumes from a seek that landed on it', () => {
    const fired: string[] = [];
    const tl = makeTimeline({ duration: 100, tracks: [track(fired, [10, 50, 90])] });
    tl.handle.pause();
    tl.handle.seek(50);
    tl.advance(0);
    expect(fired).toEqual([]);
    tl.handle.resume();
    tl.advance(1);
    expect(fired).toEqual(['@50']);
    tl.advance(2);
    expect(fired).toEqual(['@50']);
  });

  it('replays the event at zero after seeking back to the start', () => {
    const fired: string[] = [];
    const tl = makeTimeline({ duration: 100, tracks: [track(fired, [0, 50])] });
    tl.advance(0);
    tl.advance(60);
    tl.handle.seek(0);
    tl.advance(61);
    expect(fired).toEqual(['@0', '@50', '@0']);
  });

  it('fires in a nested timeline the seek landed on', () => {
    const fired: string[] = [];
    const child: Track = { kind: 'timeline', at: 40, timeline: { tracks: [track(fired, [10])] } };
    const tl = makeTimeline({ duration: 100, tracks: [child] });
    tl.handle.seek(50);
    tl.advance(1);
    expect(fired).toEqual(['@10']);
  });
});
