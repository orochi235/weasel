import { useContext } from 'react';
import { LabStoreContext } from '../state/context';

/** Marks a trial's element, and the frame its undocked panels sit in, with the trial's id. */
export const TRIAL_ATTR = 'data-trial-id';

const isElement = (node: unknown): node is Element =>
  typeof (node as Element | null)?.closest === 'function';

/**
 * The trial input at `node` belongs to, among those `owns` accepts: the nearest trial around it, or the trial an
 * undocked panel around it came from. A trial can hold a lab of its own, whose trials this lab does not own, so the
 * walk goes out past those. Null outside every trial the lab owns.
 */
export function owningTrial(node: unknown, owns: (id: string) => boolean): string | null {
  let at = isElement(node) ? node.closest(`[${TRIAL_ATTR}]`) : null;
  while (at) {
    const id = at.getAttribute(TRIAL_ATTR);
    if (id !== null && owns(id)) return id;
    at = at.parentElement?.closest(`[${TRIAL_ATTR}]`) ?? null;
  }
  return null;
}

/** Whether `id` is one of the trials of the lab whose store is in scope, read when called. With no store in scope,
 *  every trial counts as the lab's. */
export function useOwnsTrial(): (id: string) => boolean {
  const store = useContext(LabStoreContext)?.store;
  return store ? (id) => store.getState().trials.some((t) => t.id === id) : () => true;
}
