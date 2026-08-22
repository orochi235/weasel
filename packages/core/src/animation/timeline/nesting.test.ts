import { describe, expect, it } from 'vitest';
import { createTimeline, type TimelineRegister } from './createTimeline';
import type { SampledTrack, TimelineTrack } from './types';

function harness() {
  let tick: ((virtualNow: number) => boolean) | null = null;
  const register: TimelineRegister = (seed) => {
    tick = seed.tick;
    return {
      id: seed.id, cancel: () => {}, pause: () => {}, resume: () => {},
      setTimeScale: () => {}, isPaused: () => false,
    };
  };
  return { register, advance: (t: number) => tick!(t) };
}

const ramp = (onTick: (v: number) => void): SampledTrack<number> => ({
  kind: 'sampled',
  keys: [{ t: 0, value: 0 }, { t: 100, value: 100 }],
  onTick,
});

describe('nested timelines', () => {
  it('evaluates a child at playhead minus its offset', () => {
    const h = harness();
    const seen: number[] = [];
    const child: TimelineTrack = {
      kind: 'timeline',
      at: 200,
      timeline: { tracks: [ramp((v) => seen.push(v))] },
    };
    createTimeline(h.register, 1, { tracks: [child] });
    h.advance(250);
    expect(seen.at(-1)).toBe(50);
  });

  it('includes a child offset in the derived duration', () => {
    const h = harness();
    const child: TimelineTrack = {
      kind: 'timeline', at: 200, timeline: { tracks: [ramp(() => {})] },
    };
    const tl = createTimeline(h.register, 1, { tracks: [child] });
    expect(tl.duration()).toBe(300);
  });

  it('sequences two children placed at different offsets', () => {
    const h = harness();
    const a: number[] = [];
    const b: number[] = [];
    createTimeline(h.register, 1, {
      tracks: [
        { kind: 'timeline', at: 0, timeline: { tracks: [ramp((v) => a.push(v))] } },
        { kind: 'timeline', at: 100, timeline: { tracks: [ramp((v) => b.push(v))] } },
      ],
    });
    h.advance(150);
    expect(a.at(-1)).toBe(100);   // clamped past its end
    expect(b.at(-1)).toBe(50);
  });

  it('fires a child event track on forward playback', () => {
    const h = harness();
    const fired: string[] = [];
    createTimeline(h.register, 1, {
      duration: 400,
      tracks: [{
        kind: 'timeline',
        at: 100,
        timeline: { tracks: [{ kind: 'event', events: [{ t: 50, fire: () => fired.push('x') }] }] },
      }],
    });
    h.advance(200);
    expect(fired).toEqual(['x']);
  });

  it('keeps a child event track silent under seek', () => {
    const h = harness();
    const fired: string[] = [];
    const tl = createTimeline(h.register, 1, {
      duration: 400,
      tracks: [{
        kind: 'timeline',
        at: 100,
        timeline: { tracks: [{ kind: 'event', events: [{ t: 50, fire: () => fired.push('x') }] }] },
      }],
    });
    tl.seek(300);
    expect(fired).toEqual([]);
  });

  it('rejects parent-only options on a nested child', () => {
    const child: TimelineTrack = {
      kind: 'timeline',
      at: 0,
      // @ts-expect-error a child is a NestedTimeline: tracks and duration only.
      timeline: { tracks: [], loop: true },
    };
    expect(child.at).toBe(0);
  });
});
