import { holdAt, type PlayheadHold } from '@weasel-js/clock';
import { useLabContext, useTrialClockHandle } from '@weasel-js/labkit';
import { type RefObject, useEffect, useRef } from 'react';
import { routedTrial } from '../shell/routedTrial';
import { readRoute, useRoute } from '../shell/useRoute';
import { readPlayheadParam, writePlayheadParam } from './playheadUrl';
import { shownTime } from './shown';
import { compositeKey } from '@weasel-js/registry';

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
    let off: (() => void) | null = null;
    // A `t` the URL names replaces any earlier one, met or absent alike. A new hold is made with `toUrl` unsubscribed
    // and subscribes it again after, so its placing seek never reaches `toUrl` and its listener runs before `toUrl`'s on
    // each later change: a seek or a play releases it before `toUrl` asks whether it still waits.
    const fromUrl = (): void => {
      const t = readPlayheadParam();
      hold?.release();
      hold = null;
      if (t === null || t === shownTime(clock)) return;
      off?.();
      hold = holdAt(handle, t);
      if (off) off = clock.subscribe(toUrl);
    };
    // Paused off the span's start, the URL holds the time shown within the pass; playing or at the start, it holds
    // none. While the span cannot hold a requested time yet, the URL keeps the request.
    let held: number | null | undefined;
    const toUrl = (): void => {
      if (hold && hold.pending() !== null) return;
      const time = shownTime(clock);
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
    off = clock.subscribe(toUrl);
    const onHashChange = (): void => {
      // A hash naming another story belongs to the trial that takes over; this one is about to unmount.
      if (readRoute() !== route) return;
      held = undefined;
      fromUrl();
      toUrl();
    };
    window.addEventListener('hashchange', onHashChange);
    return () => {
      off?.();
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
  return <PlayheadSync key={compositeKey([trial.id, route])} trialId={trial.id} route={route} appliedRef={applied} />;
}
