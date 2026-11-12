import { afterEach, describe, expect, it, vi } from 'vitest';
import { watchElementMove } from './watchElementMove';

/** Observers that hand their callback to the test, and count how many are still connected. */
function observers() {
  const live = new Set<object>();
  const callbacks: IntersectionObserverCallback[] = [];
  class FakeIO {
    constructor(readonly cb: IntersectionObserverCallback) { callbacks.push(cb); }
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
  return { live, element, moveAndDeliver, deliverInPlace };
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
