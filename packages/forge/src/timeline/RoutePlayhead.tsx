import { holdAt, type PlayheadHold } from '@weasel-js/clock';
import { useLabContext, useTrialClockHandle } from '@weasel-js/labkit';
import { type RefObject, useEffect, useRef } from 'react';
import { routedTrial } from '../shell/routedTrial';
import { readRoute, useRoute } from '../shell/useRoute';
import { readPlayheadParam, writePlayheadParam } from './playheadUrl';
import { clockTime } from './shown';

interface PlayheadSyncProps {
  trialId: string;
  route: string;
  /** The route whose opening `t` has been applied, so a trial taking the URL over later does not adopt another's. */
  appliedRef: RefObject<string | null>;
}

/** Ties one trial's clock to the URL's `t`. */
function PlayheadSync({ trialId, route, appliedRef }: PlayheadSyncProps) {
  const handle = useTrialClockHandle(trialId);
  useEffect(() => {
    if (!handle) return;
    const { clock } = handle;
    let hold: PlayheadHold | null = null;
    const fromUrl = (): void => {
      const t = readPlayheadParam();
      if (t === null || t === clockTime(clock)) return;
      hold?.release();
      hold = holdAt(handle, t);
    };
    // Paused off the span's start, the URL holds the time, counted across passes as a hold counts it; playing or at
    // the start, it holds none. While the span cannot hold a requested time yet, the URL keeps the request.
    let held: number | null | undefined;
    const toUrl = (): void => {
      if (hold && hold.pending() !== null) return;
      const time = clockTime(clock);
      const next = clock.rate !== 0 || time === clock.origin ? null : time;
      if (next === held) return;
      held = next;
      writePlayheadParam(next);
    };
    if (appliedRef.current !== route) {
      appliedRef.current = route;
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
      hold?.release();
      window.removeEventListener('hashchange', onHashChange);
    };
  }, [handle, route, appliedRef]);
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
  return <PlayheadSync key={`${trial.id} ${route}`} trialId={trial.id} route={route} appliedRef={applied} />;
}
