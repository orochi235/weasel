import type { BindingScope } from '../interactions/dispatcher/matcher';
import type { CapabilityTag } from '@weasel-js/modes';
import type { Eligibility } from './types';

/** What the registry knows at dispatch time. */
export interface EligibilityState {
  focusedId: string | null;
  heldTriggers: ReadonlySet<string>;
  /** Ids the host reports as hotkey-engaged. A declared `offhand` registers
   *  the binding, but `tool.offhand`'s invoker still reports engagement by
   *  pushing an id — this retires only if that contract changes. */
  engagedIds?: ReadonlySet<string>;
  /** Whether the active mode allows these capability tags. Omitted → allow. */
  allows?: (tags: readonly CapabilityTag[]) => boolean;
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
  const tags = eligibility.capabilities;
  if (tags && tags.length > 0 && state.allows && !state.allows(tags)) return null;
  if (state.engagedIds?.has(id)) return 'hotkey';
  if (eligibility.offhand && state.heldTriggers.has(eligibility.offhand)) return 'hotkey';
  if (eligibility.focus && state.focusedId === id) return 'active';
  if (eligibility.always || eligibility.claimed) return 'ambient';
  return null;
}
