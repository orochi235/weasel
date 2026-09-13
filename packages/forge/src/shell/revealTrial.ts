const FLASH_MS = 600;
const flashes = new WeakMap<Element, ReturnType<typeof setTimeout>>();

/** Scrolls a trial into view and flashes its outline. False when no trial has that id. */
export function revealTrial(trialId: string, root: ParentNode = document): boolean {
  const trial = root.querySelector<HTMLElement>(`.lk-trial[data-trial-id="${CSS.escape(trialId)}"]`);
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
