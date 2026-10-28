/**
 * jsdom fires no IntersectionObserver and runs no frames on its own, so both
 * are hand-cranked: the observer is a stub that hands back its callback, and
 * the frame clock is a queue `flushAt(t)` empties.
 */

import { act, cleanup, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createClock } from './clock';
import { type ClockRegistry, createClockRegistry } from './registry';
import { useClockLoop } from './useClockLoop';

interface Watcher {
  cb: IntersectionObserverCallback;
  els: Element[];
}
let watchers: Watcher[] = [];
const observedBy = (): Element[] => watchers.flatMap((w) => w.els);

beforeEach(() => {
  watchers = [];
  vi.stubGlobal(
    'IntersectionObserver',
    class {
      private readonly watcher: Watcher;
      constructor(cb: IntersectionObserverCallback) {
        this.watcher = { cb, els: [] };
        watchers.push(this.watcher);
      }
      observe(el: Element) {
        this.watcher.els.push(el);
      }
      unobserve(el: Element) {
        this.watcher.els = this.watcher.els.filter((o) => o !== el);
      }
      disconnect() {
        this.watcher.els = [];
      }
    },
  );
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const setIntersecting = (el: Element, next: boolean) =>
  act(() => {
    for (const { cb, els } of watchers) {
      if (!els.includes(el)) continue;
      cb([{ target: el, isIntersecting: next } as IntersectionObserverEntry], null as never);
    }
  });

function makeFrames() {
  let next = 1;
  const queued = new Map<number, FrameRequestCallback>();
  const requestFrame = vi.fn((cb: FrameRequestCallback) => {
    const id = next++;
    queued.set(id, cb);
    return id;
  });
  return {
    requestFrame,
    cancelFrame: (id: number) => void queued.delete(id),
    flushAt(t: number) {
      act(() => {
        const due = [...queued.values()];
        queued.clear();
        for (const cb of due) cb(t);
      });
    },
  };
}

type Frames = ReturnType<typeof makeFrames>;

function Host({ registry, frames }: { registry: ClockRegistry; frames: Frames }) {
  useClockLoop(registry, frames);
  return null;
}

const mount = (registry: ClockRegistry, frames: Frames) =>
  render(<Host registry={registry} frames={frames} />);

const makeEl = () => document.createElement('div');

describe('useClockLoop visibility', () => {
  it('freezes a clock whose every target is out of view, and resumes without a jump', () => {
    const frames = makeFrames();
    const registry = createClockRegistry();
    const el = makeEl();
    const { clock } = (() => {
      const h = createClock({ rate: 1 });
      registry.register('t1', h, () => el);
      return h;
    })();
    mount(registry, frames);
    frames.flushAt(0);
    frames.flushAt(16);
    expect(clock.elapsed).toBe(16);
    setIntersecting(el, false);
    for (let t = 32; t <= 2000; t += 16) frames.flushAt(t);
    expect(clock.elapsed).toBe(16);
    setIntersecting(el, true);
    frames.flushAt(2016);
    frames.flushAt(2032);
    expect(clock.elapsed).toBe(32);
  });

  it('never gates the shared clock', () => {
    const frames = makeFrames();
    const shared = createClock({ rate: 1 });
    const registry = createClockRegistry(shared);
    const el = makeEl();
    registry.register('t1', shared, () => el);
    mount(registry, frames);
    frames.flushAt(0);
    setIntersecting(el, false);
    frames.flushAt(16);
    frames.flushAt(32);
    expect(shared.clock.elapsed).toBe(32);
  });

  it('gates a clock only when all its registrations are out of view', () => {
    const frames = makeFrames();
    const registry = createClockRegistry();
    const a = makeEl();
    const b = makeEl();
    const h = createClock({ rate: 1 });
    registry.register('t1', h, () => a);
    registry.register('t2', h, () => b);
    mount(registry, frames);
    frames.flushAt(0);
    setIntersecting(a, false);
    frames.flushAt(16);
    frames.flushAt(32);
    expect(h.clock.elapsed).toBe(32);
    setIntersecting(b, false);
    frames.flushAt(48);
    frames.flushAt(64);
    expect(h.clock.elapsed).toBe(32);
  });

  it('does not gate a clock with a registration that names no target', () => {
    const frames = makeFrames();
    const registry = createClockRegistry();
    const el = makeEl();
    const h = createClock({ rate: 1 });
    registry.register('t1', h, () => el);
    registry.register('t2', h);
    mount(registry, frames);
    frames.flushAt(0);
    setIntersecting(el, false);
    frames.flushAt(16);
    expect(h.clock.elapsed).toBe(16);
  });

  it('treats a target that resolves to null as visible', () => {
    const frames = makeFrames();
    const registry = createClockRegistry();
    const h = createClock({ rate: 1 });
    registry.register('t1', h, () => null);
    mount(registry, frames);
    frames.flushAt(0);
    frames.flushAt(16);
    expect(h.clock.elapsed).toBe(16);
  });

  it('requests no frames while every clock is gated or inert', () => {
    const frames = makeFrames();
    const registry = createClockRegistry();
    const el = makeEl();
    registry.register('t1', createClock({ rate: 1 }), () => el);
    registry.register('t2', createClock({}));
    mount(registry, frames);
    frames.flushAt(0);
    setIntersecting(el, false);
    frames.flushAt(16);
    const settled = frames.requestFrame.mock.calls.length;
    frames.flushAt(32);
    frames.flushAt(48);
    expect(frames.requestFrame).toHaveBeenCalledTimes(settled);
  });

  it('requests a frame when a gated playing clock comes back into view', () => {
    const frames = makeFrames();
    const registry = createClockRegistry();
    const el = makeEl();
    registry.register('t1', createClock({ rate: 1 }), () => el);
    mount(registry, frames);
    frames.flushAt(0);
    setIntersecting(el, false);
    frames.flushAt(16);
    const settled = frames.requestFrame.mock.calls.length;
    setIntersecting(el, true);
    expect(frames.requestFrame.mock.calls.length).toBe(settled + 1);
  });

  it('unobserves an element no registration names any more', () => {
    const frames = makeFrames();
    const registry = createClockRegistry();
    const el = makeEl();
    const release = registry.register('t1', createClock({ rate: 1 }), () => el);
    mount(registry, frames);
    expect(observedBy()).toEqual([el]);
    act(() => release());
    expect(observedBy()).toEqual([]);
  });
});

describe('useClockLoop per frame', () => {
  it('reads the registry only when it changes, never in a frame', () => {
    const frames = makeFrames();
    const registry = createClockRegistry();
    const el = makeEl();
    const h = createClock({ rate: 1 });
    registry.register('t1', h, () => el);
    const all = vi.spyOn(registry, 'all');
    const targets = vi.spyOn(registry, 'targets');
    mount(registry, frames);
    all.mockClear();
    targets.mockClear();
    frames.flushAt(0);
    frames.flushAt(16);
    frames.flushAt(32);
    expect(h.clock.elapsed).toBe(32);
    expect(all).not.toHaveBeenCalled();
    expect(targets).not.toHaveBeenCalled();
    const late = createClock({ rate: 1 });
    act(() => void registry.register('t2', late));
    expect(all).toHaveBeenCalled();
    frames.flushAt(48);
    frames.flushAt(64);
    expect(late.clock.elapsed).toBe(16);
  });
});
