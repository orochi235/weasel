import type { TrialContribution } from '@weasel-js/labkit';

export function TrialMarker({ trialId }: { trialId: string }) {
  return <span data-fg-trial={trialId} hidden />;
}

/** Marks every trial, so a story's trial can be found from outside it. */
export const TRIAL_MARKER: readonly TrialContribution[] = [
  { id: 'fg-trial-marker', region: 'status', render: (ctx) => <TrialMarker trialId={ctx.trialId} /> },
];

const FLASH_MS = 600;
const flashes = new WeakMap<Element, ReturnType<typeof setTimeout>>();

/** Scrolls a marked trial into view and flashes its outline. False when no trial carries the marker. */
export function revealTrial(trialId: string, root: ParentNode = document): boolean {
  const marker = [...root.querySelectorAll<HTMLElement>('[data-fg-trial]')].find((el) => el.dataset.fgTrial === trialId);
  const trial = marker?.closest<HTMLElement>('.lk-trial');
  if (!trial) return false;
  trial.scrollIntoView({ block: 'nearest' });
  clearTimeout(flashes.get(trial));
  trial.classList.remove('fg-flash');
  // Reading layout between the remove and the add restarts the animation on a second reveal.
  void trial.offsetWidth;
  trial.classList.add('fg-flash');
  flashes.set(
    trial,
    setTimeout(() => {
      trial.classList.remove('fg-flash');
      flashes.delete(trial);
    }, FLASH_MS),
  );
  return true;
}
