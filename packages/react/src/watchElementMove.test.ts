import { afterEach, describe, expect, it, vi } from 'vitest';
import { watchElementMove } from './watchElementMove';

/** Observers that hand their callback to the test, and count how many are still connected. */
function observers() {
  const live = new Set<object>();
  const callbacks: IntersectionObserverCallback[] = [];
  const built: object[] = [];
  class FakeIO {
    constructor(readonly cb: IntersectionObserverCallback) { callbacks.push(cb); built.push(this); }
    observe() { live.add(this); }
    disconnect() { live.delete(this); }
  }
  class FakeRO {
    observe() { live.add(this); }
    disconnect() { live.delete(this); }
  }
  vi.stubGlobal('IntersectionObserver', FakeIO);
  vi.stubGlobal('ResizeObserver', FakeRO);
  const element = document.createElement('div');
  let left = 10;
  element.getBoundingClientRect = () => ({ left, top: 10, width: 20, height: 20, right: left + 20, bottom: 30, x: left, y: 10 }) as DOMRect;
  /** Deliver an entry to the first frame built, as one queued for it would arrive. */
  const moveAndDeliver = () => {
    left += 5;
    callbacks[0]!([{ intersectionRatio: 0.5, boundingClientRect: element.getBoundingClientRect(), isIntersecting: true } as IntersectionObserverEntry], {} as IntersectionObserver);
  };
  /** Deliver the frame's first report, the box where it was, partly showing. */
  const deliverInPlace = (ratio: number) => {
    callbacks[0]!([{ intersectionRatio: ratio, boundingClientRect: element.getBoundingClientRect(), isIntersecting: true } as IntersectionObserverEntry], {} as IntersectionObserver);
  };
  /** Move the element, with nothing told yet. */
  const move = (dx: number) => { left += dx; };
  /** Deliver to the `i`th observer built an entry measured at `x`, as one computed before a move arrives after it. */
  const deliver = (i: number, ratio: number, x = left) => {
    const box = { left: x, top: 10, width: 20, height: 20, right: x + 20, bottom: 30, x, y: 10 } as DOMRect;
    callbacks[i]!([{ intersectionRatio: ratio, boundingClientRect: box, isIntersecting: true } as IntersectionObserverEntry], {} as IntersectionObserver);
  };
  return { live, element, moveAndDeliver, deliverInPlace, move, deliver, callbacks, built };
}

afterEach(() => { vi.unstubAllGlobals(); });

describe('watchElementMove after stopping', () => {
  it('ignores an entry queued before the stop, and builds no observer for it', () => {
    const { live, element, moveAndDeliver } = observers();
    const onMove = vi.fn();
    const stop = watchElementMove(element, onMove);
    stop();
    // The spec delivers entries queued before `disconnect()`.
    moveAndDeliver();
    expect(onMove).not.toHaveBeenCalled();
    expect(live.size).toBe(0);
  });

  it('builds no observer from a queued entry that reports no move', () => {
    const { live, element, deliverInPlace } = observers();
    const onMove = vi.fn();
    const stop = watchElementMove(element, onMove);
    stop();
    deliverInPlace(0.5);
    expect(live.size).toBe(0);
  });

  it('stays stopped when the stop comes from inside its own report', () => {
    const { live, element, moveAndDeliver } = observers();
    let stop = (): void => {};
    stop = watchElementMove(element, () => stop());
    moveAndDeliver();
    expect(live.size).toBe(0);
  });
});

describe('watchElementMove roots', () => {
  it('frames an unclipped element against its own document, not the implicit root', () => {
    const roots: unknown[] = [];
    vi.stubGlobal('IntersectionObserver', class {
      constructor(_cb: IntersectionObserverCallback, opts?: IntersectionObserverInit) { roots.push(opts?.root); }
      observe() {}
      disconnect() {}
    });
    vi.stubGlobal('ResizeObserver', class { observe() {} disconnect() {} });
    const other = document.implementation.createHTMLDocument('frame');
    const element = other.body.appendChild(other.createElement('div'));
    element.getBoundingClientRect = () => ({ left: 10, top: 10, width: 20, height: 20, right: 30, bottom: 30, x: 10, y: 10 }) as DOMRect;
    const stop = watchElementMove(element, () => {});
    expect(roots).toEqual([other]);
    stop();
  });
});

describe('watchElementMove and a move landing while a frame is rebuilt', () => {
  it('reports a move made after a partly shown first report was measured, before it arrived', () => {
    const { element, move, deliver, callbacks, built, live } = observers();
    const onMove = vi.fn();
    const stop = watchElementMove(element, onMove);
    // The first frame's report was measured at x = 10; the element moves before it is delivered.
    move(5);
    deliver(0, 0.5, 10);
    // Each frame built since then reports first, from where the element now is, unless it was taken down before
    // anything was measured for it.
    for (let i = 1; i < Math.min(callbacks.length, 20) && onMove.mock.calls.length === 0; i++) {
      if (live.has(built[i]!)) deliver(i, 0.6 + i / 100);
    }
    expect(onMove).toHaveBeenCalled();
    stop();
  });
});
