import { useLatest } from '@weasel-js/core';
import { type ReactNode, useContext, useEffect, useState } from 'react';
import type { LoadedStory } from '../story/types';
import { type Clock, createClock, type TimelineSpec } from './clock';
import { ClockContext } from './context';
import { useClockLoop } from './useClockLoop';

/**
 * A clock for a story declaring `spec`, kept across renders and redeclared when the span it declares changes. It is
 * made when a declaration appears and dropped when it goes, as an edit can do either. `initial` is read only when
 * the clock is made.
 */
export function useStoryClock(spec: TimelineSpec | null, initial: () => number | null): Clock | null {
  const [clock, setClock] = useState(() => (spec ? createClock(spec, initial()) : null));
  let current = clock;
  if (spec && !clock) {
    current = createClock(spec, initial());
    setClock(current);
  } else if (!spec && clock) {
    current = null;
    setClock(null);
  }
  const latest = useLatest(spec);
  const spanKey = spec ? `${spec.start ?? 0}:${spec.duration}` : null;
  useEffect(() => {
    if (current && latest.current) current.declare(latest.current);
  }, [current, spanKey, latest]);
  return current;
}

const NO_INITIAL = () => null;

function OwnClock({ spec, children }: { spec: TimelineSpec; children: ReactNode }) {
  const clock = useStoryClock(spec, NO_INITIAL);
  useClockLoop(clock);
  return <ClockContext.Provider value={clock}>{children}</ClockContext.Provider>;
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
