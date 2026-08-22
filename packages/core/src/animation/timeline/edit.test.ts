import { describe, expect, it, vi } from 'vitest';
import { createTimeline, type TimelineRegister } from './createTimeline';
import type { SampledTrack } from './types';

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

describe('timeline editing', () => {
  it('notifies subscribers after an edit', () => {
    const h = harness();
    const track: SampledTrack<number> = { kind: 'sampled', keys: [{ t: 0, value: 0 }], onTick: () => {} };
    const tl = createTimeline(h.register, 1, { tracks: [track] });
    const cb = vi.fn();
    tl.subscribe(cb);
    tl.edit(() => { track.keys.push({ t: 100, value: 5 }); });
    expect(cb).toHaveBeenCalledTimes(1);
  });

  it('stops notifying after unsubscribe', () => {
    const h = harness();
    const tl = createTimeline(h.register, 1, { tracks: [] });
    const cb = vi.fn();
    const off = tl.subscribe(cb);
    off();
    tl.edit(() => {});
    expect(cb).not.toHaveBeenCalled();
  });

  it('recomputes duration after an edit', () => {
    const h = harness();
    const track: SampledTrack<number> = { kind: 'sampled', keys: [{ t: 0, value: 0 }], onTick: () => {} };
    const tl = createTimeline(h.register, 1, { tracks: [track] });
    expect(tl.duration()).toBe(0);
    tl.edit(() => { track.keys.push({ t: 250, value: 5 }); });
    expect(tl.duration()).toBe(250);
  });

  it('drops the interpolator cache so an edited key takes effect', () => {
    const h = harness();
    const build = vi.fn((a: number, b: number) => (u: number) => a + (b - a) * u);
    const seen: number[] = [];
    const track: SampledTrack<number> = {
      kind: 'sampled',
      keys: [{ t: 0, value: 0 }, { t: 100, value: 100 }],
      interpolator: build,
      onTick: (v) => seen.push(v),
    };
    createTimeline(h.register, 1, { tracks: [track] });
    const tl = createTimeline(h.register, 2, { tracks: [track] });
    h.advance(50);
    expect(seen.at(-1)).toBe(50);

    tl.edit(() => { track.keys[1].value = 1000; });
    h.advance(50);
    expect(seen.at(-1)).toBe(500);
    expect(build).toHaveBeenCalledTimes(2);
  });
});
