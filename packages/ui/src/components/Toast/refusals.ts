import { subscribeRefusals, type Refusal } from '@weasel-js/routing';
import { reasonLabel } from '../ActionBar/reasonLabels';
import type { ToastQueue } from './queue';

/** The id every refusal toast shares, so a second keystroke replaces the first rather than stacking. */
export const REFUSAL_TOAST_ID = 'wzl-refusal';

// The queues of the mounted regions that tell refusals, the latest last: only it tells one.
const tellers: ToastQueue[] = [];
let unsubscribe: (() => void) | null = null;

function tell({ action, reason }: Refusal): void {
  tellers.at(-1)?.add('info', action.label, { description: reasonLabel(reason), id: REFUSAL_TOAST_ID });
}

/**
 * Have `queue` tell why a command its key reached would not run, while it is the latest queue held for this, until
 * the returned release. Folder-internal: `ToastRegion` holds its queue here.
 */
export function holdRefusals(queue: ToastQueue): () => void {
  tellers.push(queue);
  unsubscribe ??= subscribeRefusals(tell);
  return () => {
    const at = tellers.lastIndexOf(queue);
    if (at >= 0) tellers.splice(at, 1);
    if (tellers.length > 0 || !unsubscribe) return;
    unsubscribe();
    unsubscribe = null;
  };
}
