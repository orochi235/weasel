import type { BindingScope } from '../interactions/dispatcher/matcher';
import type { Eligibility } from './types';

/** What the registry knows at dispatch time. */
export interface EligibilityState {
  focusedId: string | null;
  heldTriggers: ReadonlySet<string>;
}

/**
 * The scope tier an entry's bindings are live at, or null when none are.
 * Ordered hotkey > active > ambient to match the dispatcher's own walk.
 */
export function liveScope(
  id: string,
  eligibility: Eligibility,
  state: EligibilityState,
): BindingScope | null {
  if (eligibility.offhand && state.heldTriggers.has(eligibility.offhand)) return 'hotkey';
  if (eligibility.focus && state.focusedId === id) return 'active';
  if (eligibility.always || eligibility.claimed) return 'ambient';
  return null;
}
