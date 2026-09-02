import { describe, expect, it, vi } from 'vitest';
import { makeTimeline, numberTrack } from './createTimeline.test-harness';

describe('createTimeline', () => {
  it('derives duration from the longest track', () => {
    const { handle } = makeTimeline({ tracks: [numberTrack(() => {})] });
    expect(handle.duration()).toBe(100);
  });

  it('honors an explicit duration over the derived one', () => {
    const { handle } = makeTimeline({ tracks: [numberTrack(() => {})], duration: 500 });
    expect(handle.duration()).toBe(500);
  });

  it('drives onTick with the sampled value as virtual time advances', () => {
    const seen: number[] = [];
    const { advance } = makeTimeline({ tracks: [numberTrack((v) => seen.push(v))] });
    advance(0);
    advance(50);
    expect(seen).toEqual([0, 50]);
  });

  it('reports the playhead through time()', () => {
    const { handle, advance } = makeTimeline({ tracks: [numberTrack(() => {})] });
    advance(42);
    expect(handle.time()).toBe(42);
  });

  it('finishes at duration and fires onDone exactly once', () => {
    const onDone = vi.fn();
    const { advance } = makeTimeline({ tracks: [numberTrack(() => {})], onDone });
    expect(advance(50)).toBe(false);
    expect(advance(100)).toBe(true);
    expect(onDone).toHaveBeenCalledTimes(1);
  });

  it('clamps the final sample to duration rather than overshooting', () => {
    const seen: number[] = [];
    const { advance } = makeTimeline({ tracks: [numberTrack((v) => seen.push(v))] });
    advance(180);
    expect(seen.at(-1)).toBe(100);
  });

  it('exposes its tracks for an editor to render', () => {
    const track = numberTrack(() => {});
    const { handle } = makeTimeline({ tracks: [track] });
    expect(handle.tracks()).toEqual([track]);
  });

  it('moves the playhead without waiting for a tick', () => {
    const { handle, advance } = makeTimeline({ tracks: [numberTrack(() => {})] });
    advance(10);
    handle.seek(80);
    expect(handle.time()).toBe(80);
  });

  it('keeps the seeked position as virtual time keeps advancing', () => {
    const seen: number[] = [];
    const { handle, advance } = makeTimeline({ tracks: [numberTrack((v) => seen.push(v))] });
    advance(10);
    handle.seek(80);
    advance(20);          // 10ms of real virtual time after the seek
    expect(seen.at(-1)).toBe(90);
  });

  it('seeks backward', () => {
    const { handle, advance } = makeTimeline({ tracks: [numberTrack(() => {})] });
    advance(90);
    handle.seek(10);
    advance(95);
    expect(handle.time()).toBe(15);
  });

  it('wraps the playhead instead of finishing when looping', () => {
    const { handle, advance } = makeTimeline({ tracks: [numberTrack(() => {})], loop: true });
    expect(advance(150)).toBe(false);
    expect(handle.time()).toBe(50);
  });

  it('stops after n additional loops', () => {
    const onDone = vi.fn();
    const { advance } = makeTimeline({ tracks: [numberTrack(() => {})], loop: 1, onDone });
    expect(advance(150)).toBe(false);   // first wrap consumes the one loop
    expect(advance(260)).toBe(true);    // second pass ends
    expect(onDone).toHaveBeenCalledTimes(1);
  });

  it('wraps repeatedly across a long jump', () => {
    const { handle, advance } = makeTimeline({ tracks: [numberTrack(() => {})], loop: true });
    advance(1020);
    expect(handle.time()).toBe(20);
  });

  it('plays on its own by default', () => {
    const { isPaused } = makeTimeline({ tracks: [numberTrack(() => {})] });
    expect(isPaused()).toBe(false);
  });

  it('registers paused when autoplay is false', () => {
    const { isPaused } = makeTimeline({ tracks: [numberTrack(() => {})], autoplay: false });
    expect(isPaused()).toBe(true);
  });

  it('is resumable through the returned handle', () => {
    const { handle, isPaused } = makeTimeline({ tracks: [numberTrack(() => {})], autoplay: false });
    handle.resume();
    expect(isPaused()).toBe(false);
  });

  it('terminates a zero-duration looping timeline instead of spinning', () => {
    const { handle, advance } = makeTimeline({ tracks: [], loop: true });
    expect(advance(0)).toBe(true);
    expect(advance(100)).toBe(true);
    expect(handle.time()).toBe(0);
  });

  it('fires onDone once across repeated ticks past duration', () => {
    const onDone = vi.fn();
    const { advance } = makeTimeline({ tracks: [numberTrack(() => {})], onDone });
    advance(100);
    advance(140);
    expect(onDone).toHaveBeenCalledTimes(1);
  });

  it('samples before firing, so a handler reads the current frame', () => {
    let current = -1;
    const seen: number[] = [];
    const { advance } = makeTimeline({
      duration: 100,
      tracks: [
        numberTrack((v) => { current = v; }),
        { kind: 'event', events: [{ t: 50, fire: () => seen.push(current) }] },
      ],
    });
    advance(0);
    advance(50);
    expect(seen).toEqual([50]);
  });
});
