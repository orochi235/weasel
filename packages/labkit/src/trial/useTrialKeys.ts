import { useLatest } from '@weasel-js/core';
import { useEffect } from 'react';

/**
 * A trial's chords, heard on the document: `onKey` is called for a keydown
 * from inside the trial `trialId`, and, while `takesOutside`, for one from
 * outside every trial. A chord is the trial's wherever focus is in it, and the
 * page body's falls to one trial rather than to none.
 */
export function useTrialKeys(
  trialId: string,
  takesOutside: boolean,
  onKey: (event: KeyboardEvent) => void,
): void {
  const latest = useLatest({ takesOutside, onKey });
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent): void => {
      const within =
        event.target instanceof Element ? event.target.closest('[data-trial-id]') : null;
      const mine =
        within === null
          ? latest.current.takesOutside
          : within.getAttribute('data-trial-id') === trialId;
      if (mine) latest.current.onKey(event);
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [trialId, latest]);
}
