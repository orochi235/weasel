import { describe, expect, it, vi } from 'vitest';
import { createTimeline, type TimelineRegister } from './createTimeline';
import type { SampledTrack } from './types';

/** Fake register: captures the seed's tick so a test can drive virtual time. */
function harness() {
  let tick: ((virtualNow: number) => boolean) | null = null;
  let cancelled = false;
  let onCancel: (() => void) | undefined;
  const register: TimelineRegister = (seed) => {
    tick = seed.tick;
    onCancel = seed.onCancel;
    return {
      id: seed.id,
      cancel: () => { cancelled = true; onCancel?.(); },
      pause: () => {},
      resume: () => {},
      setTimeScale: () => {},
      isPaused: () => false,
    };
  };
  return {
    register,
    /** Advance virtual time to `t`; returns true when the timeline finished. */
    advance: (t: number) => tick!(t),
    isCancelled: () => cancelled,
  };
}

const numberTrack = (onTick: (v: number) => void): SampledTrack<number> => ({
  kind: 'sampled',
  keys: [{ t: 0, value: 0 }, { t: 100, value: 100 }],
  onTick,
});

describe('createTimeline', () => {
  it('derives duration from the longest track', () => {
    const h = harness();
    const tl = createTimeline(h.register, 1, { tracks: [numberTrack(() => {})] });
    expect(tl.duration()).toBe(100);
  });

  it('honors an explicit duration over the derived one', () => {
    const h = harness();
    const tl = createTimeline(h.register, 1, { tracks: [numberTrack(() => {})], duration: 500 });
    expect(tl.duration()).toBe(500);
  });

  it('drives onTick with the sampled value as virtual time advances', () => {
    const h = harness();
    const seen: number[] = [];
    createTimeline(h.register, 1, { tracks: [numberTrack((v) => seen.push(v))] });
    h.advance(0);
    h.advance(50);
    expect(seen).toEqual([0, 50]);
  });

  it('reports the playhead through time()', () => {
    const h = harness();
    const tl = createTimeline(h.register, 1, { tracks: [numberTrack(() => {})] });
    h.advance(42);
    expect(tl.time()).toBe(42);
  });

  it('finishes at duration and fires onDone exactly once', () => {
    const h = harness();
    const onDone = vi.fn();
    createTimeline(h.register, 1, { tracks: [numberTrack(() => {})], onDone });
    expect(h.advance(50)).toBe(false);
    expect(h.advance(100)).toBe(true);
    expect(onDone).toHaveBeenCalledTimes(1);
  });

  it('clamps the final sample to duration rather than overshooting', () => {
    const h = harness();
    const seen: number[] = [];
    createTimeline(h.register, 1, { tracks: [numberTrack((v) => seen.push(v))] });
    h.advance(180);
    expect(seen.at(-1)).toBe(100);
  });

  it('exposes its tracks for an editor to render', () => {
    const h = harness();
    const track = numberTrack(() => {});
    const tl = createTimeline(h.register, 1, { tracks: [track] });
    expect(tl.tracks()).toEqual([track]);
  });

  it('moves the playhead without waiting for a tick', () => {
    const h = harness();
    const tl = createTimeline(h.register, 1, { tracks: [numberTrack(() => {})] });
    h.advance(10);
    tl.seek(80);
    expect(tl.time()).toBe(80);
  });

  it('keeps the seeked position as virtual time keeps advancing', () => {
    const h = harness();
    const seen: number[] = [];
    const tl = createTimeline(h.register, 1, { tracks: [numberTrack((v) => seen.push(v))] });
    h.advance(10);
    tl.seek(80);
    h.advance(20);          // 10ms of real virtual time after the seek
    expect(seen.at(-1)).toBe(90);
  });

  it('seeks backward', () => {
    const h = harness();
    const tl = createTimeline(h.register, 1, { tracks: [numberTrack(() => {})] });
    h.advance(90);
    tl.seek(10);
    h.advance(95);
    expect(tl.time()).toBe(15);
  });

  it('wraps the playhead instead of finishing when looping', () => {
    const h = harness();
    const tl = createTimeline(h.register, 1, { tracks: [numberTrack(() => {})], loop: true });
    expect(h.advance(150)).toBe(false);
    expect(tl.time()).toBe(50);
  });

  it('stops after n additional loops', () => {
    const h = harness();
    const onDone = vi.fn();
    createTimeline(h.register, 1, { tracks: [numberTrack(() => {})], loop: 1, onDone });
    expect(h.advance(150)).toBe(false);   // first wrap consumes the one loop
    expect(h.advance(260)).toBe(true);    // second pass ends
    expect(onDone).toHaveBeenCalledTimes(1);
  });

  it('wraps repeatedly across a long jump', () => {
    const h = harness();
    const tl = createTimeline(h.register, 1, { tracks: [numberTrack(() => {})], loop: true });
    h.advance(1020);
    expect(tl.time()).toBe(20);
  });
});
