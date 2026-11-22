import { describe, expect, it, vi } from 'vitest';
import { makeTimeline } from './createTimeline.test-harness';

describe('timeline playback notifications', () => {
  it('reports pause, resume, seek, rate, and loop changes', () => {
    const { handle } = makeTimeline({});
    const cb = vi.fn();
    handle.subscribePlayback(cb);

    handle.pause();
    handle.resume();
    handle.seek(40);
    handle.setTimeScale(2);
    handle.setLoop(true);
    expect(cb).toHaveBeenCalledTimes(5);
  });

  it('reports reaching the end, and a seek that revives it', () => {
    const tl = makeTimeline({});
    const cb = vi.fn();
    tl.handle.subscribePlayback(cb);

    tl.advance(50);
    expect(cb).not.toHaveBeenCalled();
    tl.advance(100);
    expect(cb).toHaveBeenCalledTimes(1);

    tl.handle.seek(0);
    expect(cb).toHaveBeenCalledTimes(2);
  });

  it('reports a cancel', () => {
    const { handle } = makeTimeline({});
    const cb = vi.fn();
    handle.subscribePlayback(cb);
    handle.cancel();
    expect(cb).toHaveBeenCalledTimes(1);
  });

  it('reads as canceled once canceled, and not when it only ran to its end', () => {
    const tl = makeTimeline({});
    expect(tl.handle.isCanceled()).toBe(false);
    tl.advance(1000);
    expect(tl.handle.isCanceled()).toBe(false);
    tl.handle.cancel();
    expect(tl.handle.isCanceled()).toBe(true);
  });

  it('says nothing for an edit, which `subscribe` reports, or after unsubscribing', () => {
    const { handle } = makeTimeline({});
    const cb = vi.fn();
    const off = handle.subscribePlayback(cb);
    handle.edit(() => {});
    off();
    handle.pause();
    expect(cb).not.toHaveBeenCalled();
  });

  it('keeps notifying the rest when one subscriber throws', () => {
    const { handle } = makeTimeline({});
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    const cb = vi.fn();
    handle.subscribePlayback(() => { throw new Error('boom'); });
    handle.subscribePlayback(cb);
    handle.pause();
    expect(cb).toHaveBeenCalledTimes(1);
    error.mockRestore();
  });
});
