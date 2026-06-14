/**
 * Pure matcher primitives live in `@weasel-js/gestures`. This file
 * re-exports them for kit-internal consumers and layers the actions-layer
 * binding-scope / matchBest logic on top.
 */

import { matchSpec, matchModifiers, matchKey, matchTarget, matchPhase } from '@weasel-js/gestures';
import type { GestureSpec, InputEvent, ModSpec, PhaseContext } from '@weasel-js/gestures';
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

// ---------------------------------------------------------------------------
// Binding specificity
// ---------------------------------------------------------------------------

/** Count modifier keys declared as `required` (`true`). `'optional'`,
 *  `false`, and `undefined` do NOT discriminate — they don't count. */
function modsCount(mods: ModSpec | undefined): number {
  if (!mods) return 0;
  let n = 0;
  if (mods.alt === true) n++;
  if (mods.ctrl === true) n++;
  if (mods.meta === true) n++;
  if (mods.mod === true) n++;
  if (mods.shift === true) n++;
  return n;
}

/** CSS-style specificity tuple for a GestureSpec. Higher tuple wins under
 *  lexicographic compare. Dimensions, in order of precedence:
 *
 *    [0] target — 1 if the spec declares a target predicate, else 0.
 *    [1] mods   — count of required modifier keys (shift/alt/ctrl/meta/mod).
 *                 `'optional'` does NOT count.
 *    [2] phase  — 1 if the spec declares a `phase` field, else 0.
 *    [3] exact  — placeholder, always 1. Reserved for per-kind tiebreaks.
 *
 *  Identical tuples fall back to registration order in the matcher's
 *  stable sort, preserving the pre-specificity tiebreaker. */
export function specificity(
  spec: GestureSpec,
): readonly [number, number, number, number] {
  const t = ('target' in spec && spec.target !== undefined) ? 1 : 0;
  const mods = ('mods' in spec ? spec.mods : undefined) as ModSpec | undefined;
  const m = modsCount(mods);
  const p = ('phase' in spec && spec.phase !== undefined) ? 1 : 0;
  return [t, m, p, 1];
}

/** Lexicographic compare for use as an Array.prototype.sort callback.
 *  Returns negative when `a` is MORE specific than `b` (so `a` sorts first
 *  in a descending sort), positive when less, zero when equal. */
function compareSpecificity(a: GestureSpec, b: GestureSpec): number {
  const sa = specificity(a);
  const sb = specificity(b);
  for (let i = 0; i < sa.length; i++) {
    if (sa[i] !== sb[i]) return sb[i] - sa[i];
  }
  return 0;
}

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
 * (best → worst). Ordering rules:
 *
 *   - Scopes by priority: hotkey > active > ambient.
 *   - Within a scope, more-specific bindings beat less-specific (see
 *     `specificity()`).
 *   - Among same-specificity bindings, first-declared wins (stable sort
 *     preserves registration order — same tiebreaker as pre-specificity).
 *
 * Used by the dispatcher to implement specificity-ordered fall-through:
 * when the top match's `enabled()` returns a disabled reason (or the
 * action's `start()` returns an empty handle), the next match is tried.
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
    const scopeMatches: MatchResult[] = [];
    for (const sb of bindings) {
      if (sb.scope !== scope) continue;
      const phaseCtx: PhaseContext = { selfChannel: sb.ownerToolId, engagedChannels: engaged };
      if (matchSpec(e, sb.binding.spec, isMac, phaseCtx)) {
        scopeMatches.push({ binding: sb.binding, scope, ownerToolId: sb.ownerToolId });
      }
    }
    // Stable sort by specificity descending. Identical-specificity entries
    // keep their registration order (Array.prototype.sort is stable per ES2019).
    scopeMatches.sort((a, b) => compareSpecificity(a.binding.spec, b.binding.spec));
    out.push(...scopeMatches);
  }
  return out;
}

const EMPTY_ENGAGED: ReadonlySet<string> = new Set();
