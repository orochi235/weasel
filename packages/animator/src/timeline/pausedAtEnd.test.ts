import { describe, expect, it, vi } from 'vitest';
import { makeTimeline } from './createTimeline.test-harness';
import type { EventTrack } from './types';

describe('a paused looping timeline seeked to its duration', () => {
  it('stays at its end until it plays', () => {
    const seen: number[] = [];
    const { handle, advance } = makeTimeline({
      loop: true,
      tracks: [{ kind: 'sampled', keys: [{ t: 0, value: 0 }, { t: 100, value: 100 }], onTick: (v: number) => seen.push(v) }],
    });
    advance(40);
    handle.pause();
    handle.seek(100);
    expect(advance(40)).toBe(false);
    expect(handle.time()).toBe(100);
    expect(seen.at(-1)).toBe(100);
    advance(40);
    expect(handle.time()).toBe(100);
  });

  it('wraps and counts the lap once it resumes', () => {
    const fire = vi.fn();
    const end: EventTrack = { kind: 'event', events: [{ t: 100, fire }] };
    const onDone = vi.fn();
    const { handle, advance } = makeTimeline({
      loop: 2,
      duration: 100,
      onDone,
      tracks: [end],
    });
    advance(40);
    handle.pause();
    handle.seek(100);
    advance(40);
    expect(handle.loop()).toBe(2);
    expect(fire).not.toHaveBeenCalled();
    expect(onDone).not.toHaveBeenCalled();

    handle.resume();
    advance(50);
    expect(handle.time()).toBeCloseTo(10, 6);
    expect(handle.loop()).toBe(false);
    expect(fire).toHaveBeenCalledTimes(1);
  });

  it('still wraps a paused seek past its duration', () => {
    const { handle, advance } = makeTimeline({ loop: true, duration: 100 });
    handle.pause();
    handle.seek(130);
    advance(0);
    expect(handle.time()).toBeCloseTo(30, 6);
  });
});

describe('a paused timeline at the end of its last lap', () => {
  it('fires the event at its end and finishes only once it plays', () => {
    const fire = vi.fn();
    const onDone = vi.fn();
    const { handle, advance } = makeTimeline({ duration: 100, onDone, tracks: [{ kind: 'event', events: [{ t: 100, fire }] }] });
    advance(40);
    handle.pause();
    handle.seek(100);
    expect(advance(40)).toBe(false);
    expect(onDone).not.toHaveBeenCalled();
    handle.resume();
    expect(advance(50)).toBe(true);
    expect(fire).toHaveBeenCalledTimes(1);
    expect(onDone).toHaveBeenCalledTimes(1);
  });

  it('holds a timeline made paused with no length until it plays', () => {
    const fire = vi.fn();
    const onDone = vi.fn();
    const { handle, advance } = makeTimeline({ autoplay: false, onDone, tracks: [{ kind: 'event', events: [{ t: 0, fire }] }] });
    handle.pause();
    expect(advance(0)).toBe(false);
    expect(advance(16)).toBe(false);
    expect(onDone).not.toHaveBeenCalled();
    handle.resume();
    expect(advance(32)).toBe(true);
    expect(fire).toHaveBeenCalledTimes(1);
    expect(onDone).toHaveBeenCalledTimes(1);
  });
});
