import { useEffect } from 'react';
import type { LabStore } from '../state/store';

/** Calls `pick` with the id of the trial input lands in — a press, focus
 *  moving in, or focus moving into a frame — among the trials `store` owns. */
export function useFocusPick(
  labBody: HTMLElement | null,
  store: LabStore,
  pick: (trialId: string) => void,
): void {
  useEffect(() => {
    if (!labBody) return;
    const pickFrom = (node: unknown): void => {
      const owned = new Set(store.getState().trials.map((t) => t.id));
      const nearest = (from: Element | null | undefined) =>
        from?.closest<HTMLElement>('.lk-trial[data-trial-id]') ?? null;
      let trial =
        typeof (node as Element | null)?.closest === 'function' ? nearest(node as Element) : null;
      // A trial can hold a lab of its own, whose trials this lab does not own.
      while (trial && !owned.has(trial.dataset.trialId ?? '')) trial = nearest(trial.parentElement);
      if (trial?.dataset.trialId) pick(trial.dataset.trialId);
    };
    const onInput = (event: Event): void => pickFrom(event.target);
    // Focus moving into a frame fires nothing in this document: the window
    // blurs, and the frame is the active element once it has.
    let pending: ReturnType<typeof setTimeout> | undefined;
    const doc = labBody.ownerDocument;
    const win = doc.defaultView;
    const onBlur = (): void => {
      clearTimeout(pending);
      pending = setTimeout(() => pickFrom(doc.activeElement), 0);
    };
    labBody.addEventListener('pointerdown', onInput, true);
    labBody.addEventListener('focusin', onInput, true);
    win?.addEventListener('blur', onBlur);
    return () => {
      clearTimeout(pending);
      labBody.removeEventListener('pointerdown', onInput, true);
      labBody.removeEventListener('focusin', onInput, true);
      win?.removeEventListener('blur', onBlur);
    };
  }, [labBody, store, pick]);
}
