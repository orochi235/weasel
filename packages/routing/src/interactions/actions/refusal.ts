/**
 * Keystrokes that reached a command which would not run, page-wide, as the keys are: whatever tells the user why
 * (ui's `ToastRegion`) hears every surface's.
 */
import { createEmitter } from '@weasel-js/registry';
import type { Action, ActionUnavailable } from './action';

/** A command a keystroke reached that would not run, and why: what its `enabled` answered. */
export interface Refusal {
  action: Action;
  reason: ActionUnavailable;
}

const heard = createEmitter<[Refusal]>();
const noted = new WeakSet<Event>();

/**
 * Report that `e` reached `refusal`'s command and nothing ran. Listeners hear it a task later, and only if nothing
 * else on the page took the keystroke by then (`preventDefault`): another surface's dispatcher can still bind it.
 * The first refusal noted for a keystroke is the one heard.
 */
export function noteRefusal(e: Event, refusal: Refusal): void {
  if (noted.has(e)) return;
  noted.add(e);
  setTimeout(() => {
    if (!e.defaultPrevented) heard.emit(refusal);
  }, 0);
}

/** Hear every refusal a keystroke meets on the page. Returns the unsubscribe. */
export function subscribeRefusals(listener: (refusal: Refusal) => void): () => void {
  return heard.subscribe(listener);
}
