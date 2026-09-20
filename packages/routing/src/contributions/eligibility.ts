import type { BindingScope } from '../interactions/dispatcher/matcher';
import type { CapabilityTag } from '@weasel-js/modes';
import type { Eligibility } from './types';

/** What the registry knows at dispatch time. */
export interface EligibilityState {
  focusedId: string | null;
  /** Ids the host reports as hotkey-engaged. A held `offhand` trigger reaches
   *  here the same way a palette pick does: the `tool.offhand` action pushes
   *  the tool's id onto the active-tool context's hotkey stack. */
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
  if (eligibility.focus && state.focusedId === id) return 'active';
  if (eligibility.always || eligibility.claimed) return 'ambient';
  return null;
}
