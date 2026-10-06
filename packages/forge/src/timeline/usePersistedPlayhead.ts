import { useLatest } from '@weasel-js/core';
import { useEffect, useRef } from 'react';
import type { Clock } from './clock';

/**
 * Keeps `clock`'s paused time in the trial, through `write`, so a reload or a snapshot brings the story back there.
 * It writes when the clock stops or moves while stopped, never on a playing frame. A `persisted` value arriving from
 * outside — a snapshot loaded, a Reset — is requested of the clock, so a span set later can still hold it; null
 * stands for the span's start. Nothing is written while a request waits on a span.
 */
export function usePersistedPlayhead(clock: Clock | null, persisted: number | null, write: (time: number) => void): void {
  const written = useRef(persisted);
  const latestWrite = useLatest(write);

  useEffect(() => {
    if (!clock || persisted === written.current) return;
    written.current = persisted;
    clock.request(persisted);
  }, [clock, persisted]);

  useEffect(() => {
    if (!clock) return;
    return clock.subscribe(() => {
      const { playing, time } = clock.get();
      if (playing || clock.pending() !== null || time === written.current) return;
      written.current = time;
      latestWrite.current(time);
    });
  }, [clock, latestWrite]);
}
