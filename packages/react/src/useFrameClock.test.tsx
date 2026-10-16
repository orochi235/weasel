import { act, cleanup, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { type FrameClock, type FrameClockOptions, useFrameClock } from './useFrameClock';

let hidden = false;
beforeEach(() => {
  hidden = false;
  Object.defineProperty(document, 'hidden', { configurable: true, get: () => hidden });
});
afterEach(cleanup);

const setHidden = (next: boolean): void => {
  hidden = next;
  document.dispatchEvent(new Event('visibilitychange'));
};

/** A hand-cranked frame source: `flush(ms)` runs the outstanding frame that much later. */
function makeFrames() {
  let next = 1;
  let time = 0;
  const queued = new Map<number, FrameRequestCallback>();
  return {
    requestFrame: (cb: FrameRequestCallback) => { queued.set(next, cb); return next++; },
    cancelFrame: (id: number) => { queued.delete(id); },
    pending: () => queued.size,
    flush(ms = 500) {
      time += ms;
      const due = [...queued.values()];
      queued.clear();
      for (const cb of due) cb(time);
    },
  };
}

function mount(options: FrameClockOptions) {
  const out = { clock: null as FrameClock | null, renders: 0 };
  function Host({ opts }: { opts: FrameClockOptions }) {
    out.clock = useFrameClock(opts);
    out.renders++;
    return null;
  }
  const view = render(<Host opts={options} />);
  return { out, clock: () => out.clock!, rerender: (o: FrameClockOptions) => view.rerender(<Host opts={o} />) };
}

describe('useFrameClock', () => {
  it('asks for no frame until something subscribes, and stops when the last one leaves', () => {
    const frames = makeFrames();
    const { clock } = mount(frames);
    expect(frames.pending()).toBe(0);
    const off = clock().subscribe(() => {});
    expect(frames.pending()).toBe(1);
    off();
    expect(frames.pending()).toBe(0);
  });

  it('notifies each frame with the seconds that have run, without rendering', () => {
    const frames = makeFrames();
    const { clock, out } = mount(frames);
    const seen: number[] = [];
    clock().subscribe(() => seen.push(clock().seconds()));
    const renders = out.renders;
    act(() => { frames.flush(); frames.flush(); frames.flush(); });
    expect(seen).toEqual([0, 0.5, 1]);
    expect(out.renders).toBe(renders);
  });

  it('keeps one identity across renders', () => {
    const frames = makeFrames();
    const { clock, rerender } = mount(frames);
    const first = clock();
    rerender({ ...frames });
    expect(clock()).toBe(first);
  });

  it('does not count the time the document was hidden', () => {
    const frames = makeFrames();
    const { clock } = mount(frames);
    clock().subscribe(() => {});
    act(() => { frames.flush(); frames.flush(); });
    expect(clock().seconds()).toBe(0.5);
    act(() => { setHidden(true); });
    act(() => { setHidden(false); });
    act(() => { frames.flush(3_600_000); frames.flush(); });
    expect(clock().seconds()).toBe(1);
  });

  it('holds still while paused and resumes from where it stopped', () => {
    const frames = makeFrames();
    const { clock, rerender } = mount(frames);
    const listener = vi.fn();
    clock().subscribe(listener);
    act(() => { frames.flush(); frames.flush(); });
    rerender({ ...frames, paused: true });
    expect(frames.pending()).toBe(0);
    rerender({ ...frames });
    act(() => { frames.flush(10_000); frames.flush(); });
    expect(clock().seconds()).toBe(1);
  });

  it('reads `start` before any frame has run', () => {
    const { clock } = mount({ paused: true, start: 2.5 });
    expect(clock().seconds()).toBe(2.5);
  });

  it('runs every subscriber past one that throws, and keeps asking for frames', () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    const frames = makeFrames();
    const { clock } = mount(frames);
    const after = vi.fn();
    clock().subscribe(() => { throw new Error('boom'); });
    clock().subscribe(after);
    expect(() => act(() => { frames.flush(); })).not.toThrow();
    expect(after).toHaveBeenCalledTimes(1);
    expect(frames.pending()).toBe(1);
    expect(error).toHaveBeenCalled();
    error.mockRestore();
  });
});
