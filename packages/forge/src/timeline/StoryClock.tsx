import { type ClockHandle, createClock, createClockRegistry } from '@weasel-js/clock';
import { useClockLoop } from '@weasel-js/clock/react';
import { useLatest } from '@weasel-js/core';
import { type ReactNode, useContext, useEffect, useRef, useState } from 'react';
import type { LoadedStory } from '../story/types';
import { clockSpecOf } from './clockSpec';
import { ClockContext } from './context';
import type { TimelineSpec } from './types';

const keyOf = (spec: TimelineSpec | null): string | null =>
  spec ? `${spec.start ?? 0}|${spec.duration}|${spec.loop ?? true}|${spec.rate ?? 1}` : null;

/**
 * A clock of the story's own, where no lab makes one: made when `spec` appears, dropped when it goes, and redeclared
 * when it changes; the clock keeps any span the story's `setSpan` laid over it.
 */
export function useOwnClock(spec: TimelineSpec | null): ClockHandle | null {
  const [handle, setHandle] = useState(() => (spec ? createClock(clockSpecOf(spec)) : null));
  let current = handle;
  if (spec && !handle) {
    current = createClock(clockSpecOf(spec));
    setHandle(current);
  } else if (!spec && handle) {
    current = null;
    setHandle(null);
  }
  const latest = useLatest(spec);
  const key = keyOf(spec);
  const declared = useRef(key);
  useEffect(() => {
    if (!current || !latest.current || key === declared.current) return;
    declared.current = key;
    current.declare(clockSpecOf(latest.current));
  }, [current, key, latest]);
  return current;
}

function OwnClock({ spec, children }: { spec: TimelineSpec; children: ReactNode }) {
  const handle = useOwnClock(spec);
  const [registry] = useState(() => createClockRegistry(handle));
  useClockLoop(registry);
  return <ClockContext.Provider value={handle}>{children}</ClockContext.Provider>;
}

/**
 * Gives a story declaring a timeline a clock of its own where nothing above supplies one — an index page, a frame, a
 * story test. It stands paused at the span's start, with no transport, until the story moves it.
 */
export function WithStoryClock({ story, config, children }: { story: LoadedStory; config: unknown; children: ReactNode }) {
  const outer = useContext(ClockContext);
  if (outer || !story.timeline) return children;
  return <OwnClock spec={story.timeline(config)}>{children}</OwnClock>;
}
