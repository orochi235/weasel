import { useVisibleRaf } from '@weasel-js/react';
import { useEffect } from 'react';
import type { ClockRegistry } from './registry';

/**
 * The one frame loop for every clock in a registry: syncs each clock that is not
 * inert, and sleeps once every clock is, until one wakes. Shaped like a blits
 * `ticker`, so one could take its place.
 */
export function useClockLoop(registry: ClockRegistry): void {
  const loop = useVisibleRaf(
    (timestamp, loop) => {
      let live = false;
      for (const { clock } of registry.all()) {
        if (clock.inert) continue;
        clock.sync(timestamp);
        if (!clock.inert) live = true;
      }
      if (live) loop.request();
    },
    {
      onResume: () => {
        for (const { clock } of registry.all()) clock.rebase();
      },
    },
  );

  useEffect(() => {
    let unwakes: (() => void)[] = [];
    const attach = (): void => {
      for (const off of unwakes) off();
      unwakes = [];
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
