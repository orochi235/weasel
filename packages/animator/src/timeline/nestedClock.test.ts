import { curve, sourceAt } from '@msb235/blits';
import { describe, expect, it } from 'vitest';
import { bindClip, toClip } from './clip';
import { makeTimeline, numberTrack } from './createTimeline.test-harness';
import { extentOf, forwardRuns, nestedTime } from './nestedClock';
import { rangeTimeline } from './ranges';
import type { EventTrack, TimelineTrack } from './types';

/** A nested timeline over `numberTrack`, whose value is its own clock, 0 to 100. */
const nested = (seen: number[], more: Partial<TimelineTrack> = {}): TimelineTrack => ({
  kind: 'timeline',
  at: 100,
  timeline: { tracks: [numberTrack((v) => seen.push(v))] },
  ...more,
});

describe('a retimed nested timeline', () => {
  it('runs at its rate, and from its end at a rate below 0', () => {
    expect(nestedTime(nested([], { rate: 2 }), 30)).toBe(60);
    expect(nestedTime(nested([], { rate: -1 }), 30)).toBe(70);
    expect(extentOf(nested([], { rate: 2 }))).toBe(50);
    expect(extentOf(nested([], { rate: -0.5 }))).toBe(200);
  });

  it('loops its passes, a loop for good lengthening its parent by one', () => {
    const t = nested([], { loop: 3 });
    expect(nestedTime(t, 130)).toBe(30);
    expect(nestedTime(t, 400)).toBe(100);
    expect(extentOf(t)).toBe(300);
    expect(extentOf(nested([], { loop: true }))).toBe(100);
    expect(nestedTime(nested([], { loop: true }), 1050)).toBe(50);
  });

  it('plays a remap as blits plays a voice cued with it', () => {
    const remap = { window: [80, 20] as [number, number], curve: 'ease-in' as const, length: 40 };
    const t = nested([], { remap, loop: 2 });
    for (const at of [0, 10, 39, 40, 55, 80, 120])
      expect(nestedTime(t, at)).toBeCloseTo(sourceAt(remap, Math.min(at, 80), 100, 2), 12);
    expect(nestedTime(t, 20)).toBeCloseTo(80 - curve('ease-in')(0.5) * 60, 12);
    expect(extentOf(t)).toBe(80);
  });

  it('samples the same at any time whatever order it is sought in', () => {
    const seen: number[] = [];
    const tl = makeTimeline({ tracks: [nested(seen, { rate: 0.5, loop: 2, remap: { window: [10, 90], curve: { linear: [0, 1, 0.25] } } })] });
    const at = (t: number): number => {
      tl.handle.seek(t);
      return seen.at(-1) as number;
    };
    const times = [0, 130, 260, 175, 500, 101, 333, 260, 130];
    const first = times.map(at);
    const again = [...times].reverse().map(at).reverse();
    expect(again).toEqual(first);
    for (const [i, t] of times.entries()) expect(first[i]).toBeCloseTo(nestedTime(tl.handle.tracks()[0] as TimelineTrack, t - 100), 9);
  });

  it('lengthens its parent by its retimed extent', () => {
    const tl = makeTimeline({ tracks: [nested([], { rate: 0.5, loop: 2 })] });
    expect(tl.handle.duration()).toBe(500);
  });

  it('fires its events each pass its clock runs forward through, and none played back', () => {
    const fired: number[] = [];
    const events: EventTrack = { kind: 'event', events: [{ t: 0, fire: () => fired.push(0) }, { t: 50, fire: () => fired.push(50) }] };
    const track: TimelineTrack = { kind: 'timeline', at: 0, timeline: { tracks: [events], duration: 100 }, loop: 3 };
    const tl = makeTimeline({ tracks: [track] });
    for (let t = 0; t <= 300; t += 20) tl.advance(t);
    expect(fired).toEqual([0, 50, 0, 50, 0, 50]);
    expect(forwardRuns({ ...track, rate: -1 }, 0, 100)).toEqual([]);
    expect(forwardRuns({ ...track, remap: { window: [100, 0] } }, 0, 50)).toEqual([]);
  });

  it('round-trips its rate, loop and remap through a clip', () => {
    const track = nested([], { rate: 2, loop: 3, remap: { window: [10, 60], curve: { bezier: [0.4, 0, 0.2, 1] }, length: 25 } });
    const clip = toClip({ tracks: [{ ...track, timeline: { tracks: [], duration: 100 } }] });
    expect(clip.tracks[0]).toMatchObject({ rate: 2, loop: 3, remap: { window: [10, 60], curve: { bezier: [0.4, 0, 0.2, 1] }, length: 25 } });
    const bound = bindClip(JSON.parse(JSON.stringify(clip)), {});
    expect(bound.tracks[0]).toMatchObject({ rate: 2, loop: 3, remap: { window: [10, 60], length: 25 } });
    expect(() => toClip({ tracks: [{ ...track, timeline: { tracks: [] }, remap: { curve: (u: number) => u } }] })).toThrow(/by a function/);
    expect(() => bindClip({ version: 1, tracks: [{ kind: 'timeline', at: 0, timeline: { tracks: [] }, remap: { window: [0] } }] } as never, {}))
      .toThrow(/remap window is not two times/);
  });
});

describe('a clip range', () => {
  const clip = { version: 1 as const, tracks: [], ranges: { intro: [0, 40] as [number, number], idle: [60, 90] as [number, number] } };

  it('plays or loops one by name as a nested timeline with that window', () => {
    const seen: number[] = [];
    const bound = { tracks: [numberTrack((v) => seen.push(v))], ranges: clip.ranges };
    const idle = makeTimeline(rangeTimeline(bound, 'idle', { loop: true }));
    expect(idle.handle.duration()).toBe(30);
    idle.advance(10);
    expect(seen.at(-1)).toBe(70);
    idle.advance(40);
    expect(seen.at(-1)).toBe(70);
    const intro = makeTimeline(rangeTimeline(bound, 'intro'));
    intro.advance(25);
    expect(seen.at(-1)).toBe(25);
    expect(() => rangeTimeline(bound, 'outro')).toThrow(/no range named "outro"/);
  });

  it('round-trips through a clip', () => {
    const bound = bindClip(clip, {});
    expect(bound.ranges).toEqual(clip.ranges);
    expect(toClip(bound).ranges).toEqual(clip.ranges);
    expect(() => bindClip({ ...clip, ranges: { bad: [1] } } as never, {})).toThrow(/range "bad" is not a start and an end/);
  });
});
