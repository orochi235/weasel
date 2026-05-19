/**
 * Pure matcher primitives live in `@orochi235/weasel-gestures`. This file
 * re-exports them for kit-internal consumers and layers the actions-layer
 * binding-scope / matchBest logic on top.
 */

import { matchSpec, matchModifiers, matchKey, matchTarget } from '@orochi235/weasel-gestures';
import type { InputEvent } from '@orochi235/weasel-gestures';
import type { GestureBinding } from '../actions/binding';

export { matchSpec, matchModifiers, matchKey, matchTarget };
export type { InputEvent };

// ---------------------------------------------------------------------------
// BindingScope / ScopedBinding / MatchResult
// ---------------------------------------------------------------------------

export type BindingScope = 'ambient' | 'active' | 'hotkey';

export interface ScopedBinding {
  binding: GestureBinding;
  scope: BindingScope;
}

export interface MatchResult {
  binding: GestureBinding;
  scope: BindingScope;
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
): MatchResult | null {
  const sorted = matchSorted(e, bindings, isMac);
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
): MatchResult[] {
  const out: MatchResult[] = [];
  for (const scope of SCOPE_PRIORITY) {
    for (const sb of bindings) {
      if (sb.scope === scope && matchSpec(e, sb.binding.spec, isMac)) {
        out.push({ binding: sb.binding, scope });
      }
    }
  }
  return out;
}
