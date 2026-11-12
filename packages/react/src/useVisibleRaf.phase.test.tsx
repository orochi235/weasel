/** `phase: 'update'`: a loop producing state runs ahead of the loops painting it, in the same animation frame. */
import { afterEach, describe, expect, it } from 'vitest';
import { act, cleanup, render } from '@testing-library/react';
import { useVisibleRaf, type VisibleRaf, type VisibleRafOptions } from './useVisibleRaf';

afterEach(() => { cleanup(); });

/** Frames requested while one runs wait for the next, as `requestAnimationFrame`'s do. */
function makeClock() {
  let next = 1;
  let time = 0;
  const queued = new Map<number, FrameRequestCallback>();
  return {
    requestFrame: (cb: FrameRequestCallback) => {
      const id = next++;
      queued.set(id, cb);
      return id;
    },
    cancelFrame: (id: number) => { queued.delete(id); },
    flush() {
      time += 16;
      const due = [...queued.values()];
      queued.clear();
      for (const cb of due) cb(time);
    },
  };
}

function Loop({ handle, frame, options }: {
  handle: { current: VisibleRaf | null };
  frame: (t: number, loop: VisibleRaf) => void;
  options: VisibleRafOptions;
}) {
  handle.current = useVisibleRaf(frame, options);
  return null;
}

/** A producer counting frames and asking the painter for one each time, and the painter recording what it saw. */
function mount(paintClock: ReturnType<typeof makeClock>, updateClock: ReturnType<typeof makeClock>) {
  let value = 0;
  const seen: number[] = [];
  const paint = { current: null as VisibleRaf | null };
  const update = { current: null as VisibleRaf | null };
  render(
    <>
      <Loop handle={paint} frame={() => { seen.push(value); }} options={paintClock} />
      <Loop
        handle={update}
        frame={(_t, loop) => { value++; paint.current!.request(); loop.request(); }}
        options={{ ...updateClock, phase: 'update' }}
      />
    </>,
  );
  return { seen, paint, update, value: () => value };
}

describe("useVisibleRaf phase: 'update'", () => {
  it('lands before the paint it asks for, in the same frame, whichever was scheduled first', () => {
    const clock = makeClock();
    const { seen, paint, update, value } = mount(clock, clock);
    act(() => { paint.current!.request(); update.current!.request(); });
    for (let i = 0; i < 4; i++) {
      seen.length = 0;
      act(() => { clock.flush(); });
      expect(seen).toEqual([value()]);
    }
    expect(value()).toBe(4);
  });

  it('runs a paint it asked for with none scheduled in the same frame', () => {
    const clock = makeClock();
    const { seen, update } = mount(clock, clock);
    act(() => { update.current!.request(); });
    act(() => { clock.flush(); });
    expect(seen).toEqual([1]);
  });

  it('leaves loops on another clock alone', () => {
    const paintClock = makeClock();
    const updateClock = makeClock();
    const { seen, update } = mount(paintClock, updateClock);
    act(() => { update.current!.request(); });
    act(() => { updateClock.flush(); });
    expect(seen).toEqual([]);
    act(() => { paintClock.flush(); });
    expect(seen).toEqual([1]);
  });
});
