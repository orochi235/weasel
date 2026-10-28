import { useVisibleRaf, type VisibleRafOptions } from '@weasel-js/react';
import { useEffect, useRef } from 'react';
import type { ClockRegistry, ClockTarget } from './registry';
import type { ClockHandle } from './types';

/** A clock the loop syncs, and the targets its registrations name, as of the
 *  registry's last change. */
interface Entry {
  handle: ClockHandle;
  shared: boolean;
  targets: readonly ClockTarget[];
}

const entriesOf = (registry: ClockRegistry): Entry[] =>
  Array.from(registry.all(), (handle) => ({
    handle,
    shared: handle === registry.shared,
    targets: registry.targets(handle),
  }));

/** Whether `entry`'s clock is out of sight: not the shared clock, every
 *  registration of it names an element, and none intersects the viewport. A
 *  target not yet resolved, not an element, or not yet reported counts as seen. */
function outOfSight(entry: Entry, seen: ReadonlyMap<Element, boolean>): boolean {
  if (entry.shared || entry.targets.length === 0) return false;
  return entry.targets.every((target) => {
    const el = target();
    return el instanceof Element && seen.get(el) === false;
  });
}

/** Has `io` observe every element a registration names, and lets go of the
 *  rest; `named` is scratch, reused across calls. */
function syncObserved(
  entries: readonly Entry[],
  io: IntersectionObserver | null,
  seen: Map<Element, boolean>,
  named: Set<Element>,
): void {
  if (!io) return;
  named.clear();
  for (const { targets } of entries) {
    for (const target of targets) {
      const el = target();
      if (el instanceof Element) named.add(el);
    }
  }
  for (const el of seen.keys()) {
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
  const named = useRef(new Set<Element>());
  const observer = useRef<IntersectionObserver | null>(null);
  const entries = useRef<readonly Entry[]>([]);

  const loop = useVisibleRaf(
    (timestamp, loop) => {
      syncObserved(entries.current, observer.current, seen.current, named.current);
      let live = false;
      for (const entry of entries.current) {
        const { clock } = entry.handle;
        if (outOfSight(entry, seen.current)) {
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
        for (const { handle } of entries.current) handle.clock.rebase();
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
      entries.current = entriesOf(registry);
      syncObserved(entries.current, observer.current, seen.current, named.current);
      for (const { handle } of entries.current) {
        const { clock } = handle;
        unwakes.push(clock.onWake(() => loop.request()));
        if (!clock.inert) loop.request();
      }
    };
    attach();
    const off = registry.subscribe(attach);
    return () => {
      off();
      for (const unwake of unwakes) unwake();
      entries.current = [];
    };
  }, [registry, loop]);
}
