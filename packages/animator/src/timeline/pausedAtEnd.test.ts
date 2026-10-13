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
      loop: 1,
      duration: 100,
      onDone,
      tracks: [end],
    });
    advance(40);
    handle.pause();
    handle.seek(100);
    advance(40);
    expect(handle.loop()).toBe(1);
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
