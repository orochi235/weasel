import { useVisibleRaf, type VisibleRafOptions } from '@weasel-js/react';
import { useEffect, useRef } from 'react';
import type { ClockRegistry } from './registry';
import type { ClockHandle } from './types';

/** Whether `handle` is out of sight: not the shared clock, every registration of
 *  it names an element, and none intersects the viewport. A target not yet
 *  resolved, not an element, or not yet reported counts as seen. */
function outOfSight(
  registry: ClockRegistry,
  handle: ClockHandle,
  seen: ReadonlyMap<Element, boolean>,
): boolean {
  if (handle === registry.shared) return false;
  const targets = registry.targets(handle);
  if (targets.length === 0) return false;
  return targets.every((target) => {
    const el = target();
    return el instanceof Element && seen.get(el) === false;
  });
}

/** Has `io` observe every element a registration names, and lets go of the rest. */
function syncObserved(
  registry: ClockRegistry,
  io: IntersectionObserver | null,
  seen: Map<Element, boolean>,
): void {
  if (!io) return;
  const named = new Set<Element>();
  for (const handle of registry.all()) {
    for (const target of registry.targets(handle)) {
      const el = target();
      if (el instanceof Element) named.add(el);
    }
  }
  for (const el of [...seen.keys()]) {
    if (named.has(el)) continue;
    io.unobserve(el);
    seen.delete(el);
  }
  for (const el of named) {
    if (seen.has(el)) continue;
    seen.set(el, true);
    io.observe(el);
  }
}

/**
 * The one frame loop for every clock in a registry: syncs each clock that is not
 * inert, and sleeps once every clock is, until one wakes. A clock registered with
 * a target is skipped, and rebased, while every target of it is out of the
 * viewport. Shaped like a blits `ticker`, so one could take its place.
 *
 * `options` supplies the frame clock, for tests.
 */
export function useClockLoop(
  registry: ClockRegistry,
  options?: Pick<VisibleRafOptions, 'requestFrame' | 'cancelFrame'>,
): void {
  const seen = useRef(new Map<Element, boolean>());
  const observer = useRef<IntersectionObserver | null>(null);

  const loop = useVisibleRaf(
    (timestamp, loop) => {
      syncObserved(registry, observer.current, seen.current);
      let live = false;
      for (const handle of registry.all()) {
        const { clock } = handle;
        if (outOfSight(registry, handle, seen.current)) {
          clock.rebase();
          continue;
        }
        if (clock.inert) continue;
        clock.sync(timestamp);
        if (!clock.inert) live = true;
      }
      if (live) loop.request();
    },
    {
      ...options,
      onResume: () => {
        for (const { clock } of registry.all()) clock.rebase();
      },
    },
  );

  useEffect(() => {
    const seenNow = seen.current;
    if (typeof IntersectionObserver !== 'undefined') {
      observer.current = new IntersectionObserver((entries) => {
        let returned = false;
        for (const entry of entries) {
          if (!seenNow.has(entry.target)) continue;
          if (entry.isIntersecting && seenNow.get(entry.target) === false) returned = true;
          seenNow.set(entry.target, entry.isIntersecting);
        }
        if (returned) loop.request();
      });
    }
    return () => {
      observer.current?.disconnect();
      observer.current = null;
      seenNow.clear();
    };
  }, [loop]);

  useEffect(() => {
    let unwakes: (() => void)[] = [];
    const attach = (): void => {
      for (const off of unwakes) off();
      unwakes = [];
      syncObserved(registry, observer.current, seen.current);
      for (const { clock } of registry.all()) {
        unwakes.push(clock.onWake(() => loop.request()));
        if (!clock.inert) loop.request();
      }
    };
    attach();
    const off = registry.subscribe(attach);
    return () => {
      off();
      for (const unwake of unwakes) unwake();
    };
  }, [registry, loop]);
}
