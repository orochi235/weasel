/**
 * jsdom never hides a document or fires an IntersectionObserver on its own, so
 * every gate here is driven by hand: `hide()` writes `document.hidden` and
 * dispatches the event the browser would, and the observer is a stub that hands
 * back its callback.
 */

import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { render, act, cleanup } from '@testing-library/react';
import { useRef } from 'react';
import { useVisibleRaf } from './useVisibleRaf';
import type { VisibleRaf, VisibleRafOptions } from './useVisibleRaf';
import { renderThenAbandon } from './testing/abandonRender';

let hidden = false;
let observerCallbacks: IntersectionObserverCallback[] = [];
let observed: Element[] = [];

beforeEach(() => {
  hidden = false;
  observerCallbacks = [];
  observed = [];
  Object.defineProperty(document, 'hidden', { configurable: true, get: () => hidden });
  vi.stubGlobal(
    'IntersectionObserver',
    class {
      constructor(cb: IntersectionObserverCallback) {
        observerCallbacks.push(cb);
      }
      observe(el: Element) { observed.push(el); }
      unobserve(el: Element) { observed = observed.filter((o) => o !== el); }
      disconnect() { observed = []; }
    },
  );
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const setHidden = (next: boolean) => {
  hidden = next;
  document.dispatchEvent(new Event('visibilitychange'));
};

const setIntersecting = (next: boolean) => {
  for (const cb of observerCallbacks) {
    cb([{ isIntersecting: next, target: observed.at(-1) } as IntersectionObserverEntry], null as never);
  }
};

/** A hand-cranked clock: `flush()` runs whatever frame is outstanding. */
function makeClock() {
  let next = 1;
  const queued = new Map<number, FrameRequestCallback>();
  let time = 0;
  return {
    requestFrame: (cb: FrameRequestCallback) => {
      const id = next++;
      queued.set(id, cb);
      return id;
    },
    cancelFrame: (id: number) => { queued.delete(id); },
    pending: () => queued.size,
    flush(advanceMs = 16) {
      time += advanceMs;
      const due = [...queued.entries()];
      queued.clear();
      for (const [, cb] of due) cb(time);
    },
  };
}

function Host({
  loopRef, frame, options,
}: {
  loopRef: { current: VisibleRaf | null };
  frame: (t: number, loop: VisibleRaf) => void;
  options?: VisibleRafOptions;
}) {
  loopRef.current = useVisibleRaf(frame, options);
  return null;
}

function TargetHost({
  loopRef, frame, options,
}: {
  loopRef: { current: VisibleRaf | null };
  frame: (t: number, loop: VisibleRaf) => void;
  options: VisibleRafOptions;
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  loopRef.current = useVisibleRaf(frame, { ...options, target: ref });
  return <div ref={ref} />;
}

function mount(frame: (t: number, loop: VisibleRaf) => void, options: VisibleRafOptions = {}, withTarget = false) {
  const loopRef = { current: null as VisibleRaf | null };
  const Comp = withTarget ? TargetHost : Host;
  const view = render(<Comp loopRef={loopRef} frame={frame} options={options as VisibleRafOptions} />);
  return { loop: () => loopRef.current!, ...view };
}

describe('useVisibleRaf', () => {
  it('runs a requested frame while visible', () => {
    const clock = makeClock();
    const frame = vi.fn();
    const { loop } = mount(frame, clock);
    act(() => { loop().request(); });
    act(() => { clock.flush(); });
    expect(frame).toHaveBeenCalledTimes(1);
  });

  it('hands the frame its own handle, so a continuous loop re-requests through it', () => {
    const clock = makeClock();
    const handles: VisibleRaf[] = [];
    const { loop } = mount((_t, self) => { handles.push(self); self.request(); }, clock);
    act(() => { loop().request(); });
    act(() => { clock.flush(); });
    act(() => { clock.flush(); });
    expect(handles).toEqual([loop(), loop()]);
    expect(clock.pending()).toBe(1);
  });

  it('coalesces repeated requests into one frame', () => {
    const clock = makeClock();
    const frame = vi.fn();
    const { loop } = mount(frame, clock);
    act(() => { loop().request(); loop().request(); loop().request(); });
    expect(clock.pending()).toBe(1);
    act(() => { clock.flush(); });
    expect(frame).toHaveBeenCalledTimes(1);
  });

  it('holds a request made while hidden and runs it on resume', () => {
    const clock = makeClock();
    const frame = vi.fn();
    const { loop } = mount(frame, clock);

    act(() => { setHidden(true); });
    act(() => { loop().request(); });
    act(() => { clock.flush(); });
    expect(frame).not.toHaveBeenCalled();

    act(() => { setHidden(false); });
    act(() => { clock.flush(); });
    expect(frame).toHaveBeenCalledTimes(1);
  });

  it('drops the outstanding frame when the document hides mid-loop', () => {
    const clock = makeClock();
    const frame = vi.fn(() => { loop().request(); });
    let loop!: () => VisibleRaf;
    ({ loop } = mount(frame, clock));

    act(() => { loop().request(); });
    act(() => { clock.flush(); });
    expect(frame).toHaveBeenCalledTimes(1);
    expect(clock.pending()).toBe(1);

    act(() => { setHidden(true); });
    expect(clock.pending()).toBe(0);
    act(() => { clock.flush(); });
    expect(frame).toHaveBeenCalledTimes(1);

    act(() => { setHidden(false); });
    act(() => { clock.flush(); });
    expect(frame).toHaveBeenCalledTimes(2);
  });

  it('fires onResume once, before the frame that follows it', () => {
    const clock = makeClock();
    const order: string[] = [];
    const frame = vi.fn(() => { order.push('frame'); });
    const onResume = vi.fn(() => { order.push('resume'); });
    const { loop } = mount(frame, { ...clock, onResume });

    act(() => { loop().request(); });
    act(() => { clock.flush(); });
    expect(onResume).not.toHaveBeenCalled();

    act(() => { loop().request(); });
    act(() => { setHidden(true); });
    act(() => { setHidden(false); });
    act(() => { clock.flush(); });

    expect(onResume).toHaveBeenCalledTimes(1);
    expect(order).toEqual(['frame', 'resume', 'frame']);
  });

  it('fires onSuspend once as it goes into suspension, and again only after a resume', () => {
    const clock = makeClock();
    const onSuspend = vi.fn();
    const onResume = vi.fn();
    const { loop } = mount(vi.fn(), { ...clock, onSuspend, onResume });
    act(() => { loop().request(); });
    act(() => { setHidden(true); });
    act(() => { loop().request(); });
    act(() => { document.dispatchEvent(new Event('visibilitychange')); });
    expect(onSuspend).toHaveBeenCalledTimes(1);
    expect(onResume).not.toHaveBeenCalled();
    act(() => { setHidden(false); });
    act(() => { setHidden(true); });
    expect(onSuspend).toHaveBeenCalledTimes(2);
    expect(onResume).toHaveBeenCalledTimes(1);
  });

  it('does not fire onResume for a visibilitychange that changes nothing', () => {
    const clock = makeClock();
    const onResume = vi.fn();
    const { loop } = mount(vi.fn(), { ...clock, onResume });
    act(() => { loop().request(); });
    act(() => { document.dispatchEvent(new Event('visibilitychange')); });
    expect(onResume).not.toHaveBeenCalled();
  });

  it('keeps running while hidden when the escape hatch is set', () => {
    const clock = makeClock();
    const frame = vi.fn();
    const { loop } = mount(frame, { ...clock, dangerouslyRunWhenHidden: true });
    act(() => { setHidden(true); });
    act(() => { loop().request(); });
    act(() => { clock.flush(); });
    expect(frame).toHaveBeenCalledTimes(1);
  });

  it('resumes on return when the escape hatch is lifted while hidden', () => {
    const clock = makeClock();
    const frame = vi.fn((_t: number, l: VisibleRaf) => l.request());
    const onResume = vi.fn();
    const loopRef = { current: null as VisibleRaf | null };
    const opts = { ...clock, onResume };
    const view = render(<Host loopRef={loopRef} frame={frame} options={{ ...opts, dangerouslyRunWhenHidden: true }} />);
    act(() => { setHidden(true); });
    act(() => { loopRef.current!.request(); });
    act(() => { clock.flush(); });
    expect(frame).toHaveBeenCalledTimes(1);

    view.rerender(<Host loopRef={loopRef} frame={frame} options={opts} />);
    act(() => { clock.flush(); });
    expect(frame).toHaveBeenCalledTimes(1);

    act(() => { setHidden(false); });
    act(() => { clock.flush(); });
    expect(onResume).toHaveBeenCalledTimes(1);
    expect(frame).toHaveBeenCalledTimes(2);
  });

  it('runs a held request once the escape hatch is set while hidden', () => {
    const clock = makeClock();
    const frame = vi.fn();
    const loopRef = { current: null as VisibleRaf | null };
    const view = render(<Host loopRef={loopRef} frame={frame} options={clock} />);
    act(() => { setHidden(true); });
    act(() => { loopRef.current!.request(); });
    act(() => { clock.flush(); });
    expect(frame).not.toHaveBeenCalled();

    view.rerender(<Host loopRef={loopRef} frame={frame} options={{ ...clock, dangerouslyRunWhenHidden: true }} />);
    act(() => { clock.flush(); });
    expect(frame).toHaveBeenCalledTimes(1);
  });

  it('reads the latest of several reports the observer batches together', () => {
    const clock = makeClock();
    const frame = vi.fn();
    const { loop } = mount(frame, clock, true);
    const target = observed[0]!;
    act(() => {
      for (const cb of observerCallbacks) {
        cb([
          { isIntersecting: true, target } as IntersectionObserverEntry,
          { isIntersecting: false, target } as IntersectionObserverEntry,
        ], null as never);
      }
    });
    act(() => { loop().request(); });
    act(() => { clock.flush(); });
    expect(frame).not.toHaveBeenCalled();
  });

  it('suspends while the named element is out of the viewport', () => {
    const clock = makeClock();
    const frame = vi.fn();
    const { loop } = mount(frame, clock, true);
    expect(observed).toHaveLength(1);

    act(() => { setIntersecting(false); });
    act(() => { loop().request(); });
    act(() => { clock.flush(); });
    expect(frame).not.toHaveBeenCalled();

    act(() => { setIntersecting(true); });
    act(() => { clock.flush(); });
    expect(frame).toHaveBeenCalledTimes(1);
  });

  it('resumes, rebase first, when a suspended loop\'s target is swapped for one not yet reported', () => {
    const clock = makeClock();
    const a = document.createElement('div');
    const b = document.createElement('div');
    let target: Element = a;
    const order: string[] = [];
    const { loop } = mount(() => order.push('frame'), {
      ...clock,
      target: () => target,
      onResume: () => order.push('resume'),
      onSuspend: () => order.push('suspend'),
    });
    act(() => { loop().request(); });
    act(() => { setIntersecting(false); });
    target = b;
    act(() => { loop().request(); });
    act(() => { clock.flush(); });
    expect(order).toEqual(['suspend', 'resume', 'frame']);

    act(() => { setHidden(true); });
    expect(order).toEqual(['suspend', 'resume', 'frame', 'suspend']);
  });

  it('cancels a held request without running it later', () => {
    const clock = makeClock();
    const frame = vi.fn();
    const { loop } = mount(frame, clock);
    act(() => { setHidden(true); });
    act(() => { loop().request(); });
    act(() => { loop().cancel(); });
    act(() => { setHidden(false); });
    act(() => { clock.flush(); });
    expect(frame).not.toHaveBeenCalled();
  });

  it('declines a request once unmounted', () => {
    const clock = makeClock();
    const frame = vi.fn();
    const { loop, unmount } = mount(frame, clock);
    const handle = loop();
    unmount();
    act(() => { handle.request(); });
    act(() => { clock.flush(); });
    expect(frame).not.toHaveBeenCalled();
  });

  it('reports the gate through isVisible', () => {
    const clock = makeClock();
    const { loop } = mount(vi.fn(), clock);
    expect(loop().isVisible()).toBe(true);
    act(() => { setHidden(true); });
    expect(loop().isVisible()).toBe(false);
  });

  it('runs the committed frame callback and clock, not an abandoned render\'s', () => {
    const committed = makeClock();
    const abandoned = makeClock();
    const frameA = vi.fn();
    const frameB = vi.fn();
    const loopRef = { current: null as VisibleRaf | null };
    renderThenAbandon<'a' | 'b'>('a', 'b', (w) => (
      <Host
        loopRef={loopRef}
        frame={w === 'a' ? frameA : frameB}
        options={w === 'a' ? committed : abandoned}
      />
    ));
    act(() => { loopRef.current!.request(); });
    expect(abandoned.pending()).toBe(0);
    act(() => { committed.flush(); });
    expect(frameA).toHaveBeenCalledTimes(1);
    expect(frameB).not.toHaveBeenCalled();
  });
});
