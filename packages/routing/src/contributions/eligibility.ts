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
  /** The innermost open keymap's id: the one keymap entry that is live. */
  openKeymap?: string | null;
  /** The `owner` of the affordance the input being routed hit, `null` when it
   *  hit none. Absent when no input is being routed (drawing overlays, asking
   *  whether any binding could match), where a `claimed` entry counts as live. */
  inputOwner?: string | null;
}

/** Whether a hit `owner` produced is entry `id`'s own under its `claimed` declaration. */
export function ownsAffordance(
  id: string,
  claimed: NonNullable<Eligibility['claimed']>,
  owner: string | null,
): boolean {
  if (owner === null) return false;
  return owner === id || (claimed !== true && claimed.includes(owner));
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
  if (tags && state.allows && !state.allows(tags)) return null;
  if (eligibility.keymap) return state.openKeymap === id ? 'hotkey' : null;
  if (state.engagedIds?.has(id)) return 'hotkey';
  if (eligibility.focus && state.focusedId === id) return 'active';
  if (eligibility.always) return 'ambient';
  const claimed = eligibility.claimed;
  if (claimed && (state.inputOwner === undefined || ownsAffordance(id, claimed, state.inputOwner))) return 'ambient';
  return null;
}
