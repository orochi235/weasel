import { useEffect, useState } from 'react';
import type { LabStore } from '../state/store';
import { owningTrial } from './owningTrial';

/** Calls `pick` with the id of the trial input lands in, or whose undocked panel it lands in — a press, focus
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
      const trial = owningTrial(node, (id) => owned.has(id));
      if (trial !== null) pick(trial);
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

/** The trial input last landed in while it is still one of `trialIds`, otherwise the first of them; and `focus`,
 *  which moves it. */
export function useFocusedTrial(
  labBody: HTMLElement | null,
  store: LabStore,
  trialIds: readonly string[],
): { focusedTrialId: string | null; focus: (trialId: string) => void } {
  const [focusPick, setFocusPick] = useState<string | null>(null);
  useFocusPick(labBody, store, setFocusPick);
  const focusedTrialId = trialIds.find((id) => id === focusPick) ?? trialIds[0] ?? null;
  return { focusedTrialId, focus: setFocusPick };
}
