import type { ScopedBinding } from '../interactions/dispatcher/matcher';
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
  entries: Iterable<Contribution>,
  state: EligibilityState,
): ScopedBinding[] {
  const out: ScopedBinding[] = [];
  for (const entry of entries) {
    const scope = liveScope(entry.id, entry.eligibility ?? {}, state);
    if (scope === null) continue;
    for (const binding of entry.bindings ?? []) {
      out.push({ binding, scope, ownerToolId: entry.id });
    }
  }
  return out;
}
