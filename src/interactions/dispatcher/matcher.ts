/**
 * Pure matcher primitives live in `@orochi235/weasel-gestures`. This file
 * re-exports them for kit-internal consumers and layers the actions-layer
 * binding-scope / matchBest logic on top.
 */

import { matchSpec, matchModifiers, matchKey, matchTarget, matchPhase } from '@orochi235/weasel-gestures';
import type { InputEvent, PhaseContext } from '@orochi235/weasel-gestures';
import type { GestureBinding } from '../actions/binding';

export { matchSpec, matchModifiers, matchKey, matchTarget, matchPhase };
export type { InputEvent, PhaseContext };

// ---------------------------------------------------------------------------
// BindingScope / ScopedBinding / MatchResult
// ---------------------------------------------------------------------------

export type BindingScope = 'ambient' | 'active' | 'hotkey';

export interface ScopedBinding {
  binding: GestureBinding;
  scope: BindingScope;
  /** Tool id that owns this binding — `'&'`-channel phase atoms resolve
   *  to this. `null` for ambient bindings that came from a registered
   *  Action with no owning tool. */
  ownerToolId: string | null;
}

export interface MatchResult {
  binding: GestureBinding;
  scope: BindingScope;
  /** Tool id that owns the binding — propagated from `ScopedBinding`
   *  so the dispatcher can record it as the handle owner. */
  ownerToolId: string | null;
}

// ---------------------------------------------------------------------------
// matchBest / matchSorted
// ---------------------------------------------------------------------------

const SCOPE_PRIORITY: readonly BindingScope[] = ['hotkey', 'active', 'ambient'];

/**
 * Find the best-matching binding across all scopes.
 *
 * Precedence: hotkey > active > ambient.
 * Within a scope, first-declared wins (target-specificity tie-breaking deferred
 * to Task 3 when target classification arrives).
 * Returns null when nothing matches.
 *
 * Note: this returns only the single best match. The dispatcher uses
 * `matchSorted` so it can fall through to lower-specificity matches when a
 * higher-specificity match's `enabled()` reports disabled.
 */
export function matchBest(
  e: InputEvent,
  bindings: readonly ScopedBinding[],
  isMac: boolean,
  engagedChannels?: ReadonlySet<string>,
): MatchResult | null {
  const sorted = matchSorted(e, bindings, isMac, engagedChannels);
  return sorted.length > 0 ? sorted[0] : null;
}

/**
 * Find every binding that matches the event, sorted by precedence
 * (best → worst). Same ordering rules as `matchBest`: hotkey > active >
 * ambient, first-declared within a scope.
 *
 * Used by the dispatcher to implement specificity-ordered fall-through:
 * when the top match's `enabled()` returns a disabled reason, the next
 * match in the list is tried.
 */
export function matchSorted(
  e: InputEvent,
  bindings: readonly ScopedBinding[],
  isMac: boolean,
  engagedChannels?: ReadonlySet<string>,
): MatchResult[] {
  const out: MatchResult[] = [];
  const engaged = engagedChannels ?? EMPTY_ENGAGED;
  for (const scope of SCOPE_PRIORITY) {
    for (const sb of bindings) {
      if (sb.scope !== scope) continue;
      const phaseCtx: PhaseContext = { selfChannel: sb.ownerToolId, engagedChannels: engaged };
      if (matchSpec(e, sb.binding.spec, isMac, phaseCtx)) {
        out.push({ binding: sb.binding, scope, ownerToolId: sb.ownerToolId });
      }
    }
  }
  return out;
}

const EMPTY_ENGAGED: ReadonlySet<string> = new Set();
