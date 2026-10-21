import type { ScopedBinding } from '../interactions/dispatcher/matcher';
import { capabilitiesAllowed, type CapabilityTag } from '@weasel-js/modes';
import { bindingId, NO_OVERRIDES, overridden, type ResolvedBindingOverrides } from '../interactions/actions/bindingOverrides';
import { liveScope, type EligibilityState } from './eligibility';
import type { Contribution } from './types';

/**
 * Every binding the entry set contributes right now, each tiered by the
 * entry's own declared eligibility. Entries with no live tier are omitted.
 *
 * Order is preserved: `matchSorted` sorts by specificity within a scope and
 * breaks ties by declaration order, so the caller's entry order decides which
 * of two same-specificity bindings in one tier wins.
 */
export function scopeBindings(
  entries: Iterable<Contribution<unknown>>,
  state: EligibilityState,
  overrides: ResolvedBindingOverrides = NO_OVERRIDES,
): ScopedBinding[] {
  const out: ScopedBinding[] = [];
  for (const entry of entries) {
    const scope = liveScope(entry.id, entry.eligibility ?? {}, state);
    if (scope === null) continue;
    (entry.bindings ?? []).forEach((declared, i) => {
      const binding = overridden(declared, bindingId(declared, entry.id, i), overrides);
      if (binding) out.push({ binding, scope, ownerId: entry.id });
    });
  }
  return out;
}

/** What decides which entries are live, and in what order they are walked. */
export interface AssemblyInputs {
  focusedId: string | null;
  /** Ids held by a hotkey, oldest first, as the active-tool context keeps them. */
  hotkeyStack: readonly string[];
  /** The capability tags the active mode allows. Omitted: no mode system, so
   *  every entry is allowed. */
  allowedCapabilities?: ReadonlySet<CapabilityTag>;
  /** The innermost open keymap's id, if one is open. */
  openKeymap?: string | null;
}

/**
 * The entry set as routing walks it, with the state that tiers it. The
 * dispatcher's bindings and a canvas's tool overlays both come from here, so a
 * tool the dispatcher would not route to is never drawn, and two held tools
 * stack in one order.
 *
 * Held entries lead, newest hold first: the top of the stack is the one every
 * reader treats as engaged, so it wins a tie within the hotkey tier. A tagged
 * entry is live only while the mode allows every one of its tags.
 */
export function assembleEntries<T extends Contribution<unknown>>(
  entries: Iterable<T>,
  inputs: AssemblyInputs,
): { ordered: T[]; state: EligibilityState } {
  const all = [...entries];
  const ordered: T[] = [];
  for (let i = inputs.hotkeyStack.length - 1; i >= 0; i--) {
    const entry = all.find((e) => e.id === inputs.hotkeyStack[i]);
    if (entry && !ordered.includes(entry)) ordered.push(entry);
  }
  for (const entry of all) {
    if (!ordered.includes(entry)) ordered.push(entry);
  }
  const allowed = inputs.allowedCapabilities;
  return {
    ordered,
    state: {
      focusedId: inputs.focusedId,
      engagedIds: new Set(inputs.hotkeyStack),
      ...(inputs.openKeymap ? { openKeymap: inputs.openKeymap } : {}),
      ...(allowed ? { allows: (tags: readonly CapabilityTag[]) => capabilitiesAllowed(allowed, tags) } : {}),
    },
  };
}
