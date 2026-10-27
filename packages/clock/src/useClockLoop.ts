import { useVisibleRaf, type VisibleRafOptions } from '@weasel-js/react';
import { useEffect, useRef } from 'react';
import type { ClockRegistry } from './registry';
import type { ClockHandle } from './types';

/** Whether `handle` is out of sight: not the shared clock, every registration of
 *  it names an element, and none intersects the viewport. An element not yet
 *  resolved, or not yet reported, counts as seen. */
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
    return el !== null && seen.get(el) === false;
  });
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

  /** Observes every element a registration names, and lets go of the rest. */
  const syncObserved = (): void => {
    const io = observer.current;
    if (!io) return;
    const named = new Set<Element>();
    for (const handle of registry.all()) {
      for (const target of registry.targets(handle)) {
        const el = target();
        if (el) named.add(el);
      }
    }
    for (const el of [...seen.current.keys()]) {
      if (named.has(el)) continue;
      io.unobserve(el);
      seen.current.delete(el);
    }
    for (const el of named) {
      if (seen.current.has(el)) continue;
      seen.current.set(el, true);
      io.observe(el);
    }
  };

  const loop = useVisibleRaf(
    (timestamp, loop) => {
      syncObserved();
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
    if (typeof IntersectionObserver !== 'undefined') {
      observer.current = new IntersectionObserver((entries) => {
        let returned = false;
        for (const entry of entries) {
          if (!seen.current.has(entry.target)) continue;
          if (entry.isIntersecting && seen.current.get(entry.target) === false) returned = true;
          seen.current.set(entry.target, entry.isIntersecting);
        }
        if (returned) loop.request();
      });
    }
    return () => {
      observer.current?.disconnect();
      observer.current = null;
      seen.current.clear();
    };
  }, [loop]);

  useEffect(() => {
    let unwakes: (() => void)[] = [];
    const attach = (): void => {
      for (const off of unwakes) off();
      unwakes = [];
      syncObserved();
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [registry, loop]);
}
