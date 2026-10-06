import { useLabContext } from '@weasel-js/labkit';
import { type RefObject, useEffect, useRef } from 'react';
import { routedTrial } from '../shell/routedTrial';
import { readRoute, useRoute } from '../shell/useRoute';
import { readPlayheadParam, writePlayheadParam } from './playheadUrl';
import { useTrialClock } from './trialClocks';

interface PlayheadSyncProps {
  trialId: string;
  route: string;
  /** The route whose opening `t` has been applied, so a trial taking the URL over later does not adopt another's. */
  applied: RefObject<string | null>;
}

/** Ties one trial's clock to the URL's `t`. */
function PlayheadSync({ trialId, route, applied }: PlayheadSyncProps) {
  const clock = useTrialClock(trialId);
  useEffect(() => {
    if (!clock) return;
    const fromUrl = (): void => {
      const t = readPlayheadParam();
      if (t === null || t === clock.get().time) return;
      clock.pause();
      clock.seek(t);
    };
    // Paused off the span's start, the URL holds the time; playing or at the start, it holds none.
    let held: number | null | undefined;
    const toUrl = (): void => {
      const { playing, time, span } = clock.get();
      const next = playing || time === span.start ? null : time;
      if (next === held) return;
      held = next;
      writePlayheadParam(next);
    };
    if (applied.current !== route) {
      applied.current = route;
      fromUrl();
    }
    toUrl();
    const off = clock.subscribe(toUrl);
    const onHashChange = (): void => {
      // A hash naming another story belongs to the trial that takes over; this one is about to unmount.
      if (readRoute() !== route) return;
      held = undefined;
      fromUrl();
      toUrl();
    };
    window.addEventListener('hashchange', onHashChange);
    return () => {
      off();
      window.removeEventListener('hashchange', onHashChange);
    };
  }, [clock, route, applied]);
  return null;
}

/**
 * Holds the playhead of the trial showing the routed story in the URL's `t`, by the rule the knobs follow: the
 * focused trial when it shows that story, else the first that does. No other trial's clock touches the URL.
 */
export function RoutePlayhead() {
  const lab = useLabContext();
  const [route] = useRoute();
  const applied = useRef<string | null>(null);
  const trial = route === null ? undefined : routedTrial(lab.trials, lab.focusedTrialId, route);
  if (!trial || route === null) return null;
  return <PlayheadSync key={`${trial.id} ${route}`} trialId={trial.id} route={route} applied={applied} />;
}
