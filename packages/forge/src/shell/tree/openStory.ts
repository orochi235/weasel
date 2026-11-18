import type { LabChromeContext } from '@weasel-js/labkit';
import type { IndexEntry } from '../../story/types';
import { revealTrial } from '../revealTrial';
import { setRoute } from '../useRoute';

/** Runs `entry` in the lab's focused trial, or with `another` in a new one, and names it in the URL. */
export function openStory(ctx: LabChromeContext, entry: IndexEntry, another: boolean): void {
  const focused = ctx.trials.find((trial) => trial.id === ctx.focusedTrialId);
  if (another || !focused) ctx.addTrial(entry.id);
  else if (focused.instrumentName === entry.id) {
    // The URL may name another story, or none; the trial's knobs stand, or the route would read as "no knobs set".
    revealTrial(focused.id);
    setRoute(entry.id, { fromTrial: true });
    return;
  } else {
    ctx.swapTrial(focused.id, entry.id);
    setRoute(entry.id, { inPlace: true });
    return;
  }
  setRoute(entry.id);
}
