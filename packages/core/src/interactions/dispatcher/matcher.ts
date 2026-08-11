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

/**
 * Rank a `TargetSpec` by how much it narrows. Graduated so a target that
 * names a specific thing outranks one that only names a class of things:
 *
 *    3 — `kind:<k>:selected`: this kind AND in the selection
 *    2 — `kind:<k>` / `affordance:<k>`: one named kind
 *    1 — `'empty'` / `'selected-body'` / `'unselected-body'` / `{ kindOf }`
 *    0 — no target
 *
 * A predicate stays at 1 because its narrowness is unknowable statically —
 * `hit == null` and `isRotateHandle` are the same shape here. That is also
 * what keeps this addition from reordering any binding that existed before
 * the `kind:`/`affordance:` forms resolved: every one of them ranks 0 or 1.
 */
function targetRank(target: unknown): number {
  if (target === undefined) return 0;
  if (typeof target !== 'string') return 1;
  if (target.startsWith('kind:')) return target.endsWith(':selected') ? 3 : 2;
  if (target.startsWith('affordance:')) return 2;
  return 1;
}

/**
 * True when a spec's target actually consults the affordance hit rather than
 * only the body classification. `kindOf` predicates are handed the hit;
 * `affordance:<k>` matches on its `kind`. The body-class strings (`'empty'`,
 * `'selected-body'`, `'unselected-body'`) and the `kind:` forms resolve from
 * `bodyTarget` / `bodyKind` and never see it — which is why chrome floating
 * over empty canvas used to read as empty canvas.
 */
export function targetConsultsAffordance(specTarget: unknown): boolean {
  if (specTarget === undefined) return false;
  if (typeof specTarget === 'object' && specTarget !== null && 'kindOf' in specTarget) return true;
  return typeof specTarget === 'string' && specTarget.startsWith('affordance:');
}

function specTargetOf(spec: GestureSpec): unknown {
  return 'target' in spec ? spec.target : undefined;
}

function claimOf(e: InputEvent): { owner?: string; strength?: 'exclusive' | 'shared' } | undefined {
  return ('affordance' in e ? e.affordance : undefined) as
    { owner?: string; strength?: 'exclusive' | 'shared' } | undefined;
}

/** `'exclusive'` when the event carries a claim that bars unnamed bindings. */
function isExclusiveClaim(e: InputEvent): boolean {
  return claimOf(e)?.strength === 'exclusive';
}

const warnedDeadClaims = new Set<string>();

/** Dev-only. An exclusive claim that matches no binding drops the press with
 *  no diagnostic, which reads exactly like deliberate blocking. */
function reportDeadClaim(owner: string | undefined, warn: (message: string) => void): void {
  if (process.env.NODE_ENV === 'production') return;
  const key = String(owner);
  if (warnedDeadClaims.has(key)) return;
  warnedDeadClaims.add(key);
  warn(
    `[weasel] exclusive claim by "${key}" matched no binding: no `
    + '`affordance:` or `kindOf` target resolved against it, so the press was dropped.',
  );
}

/** CSS-style specificity tuple for a GestureSpec. Higher tuple wins under
 *  lexicographic compare. Dimensions, in order of precedence:
 *
 *    [0] target — how much the spec's target narrows; see `targetRank`.
 *    [1] mods   — count of required modifier keys (shift/alt/ctrl/meta/mod).
 *                 `'optional'` does NOT count.
 *    [2] phase  — 1 if the spec declares a `phase` field, else 0.
 *    [3] exact  — per-kind tiebreak: 2 for a drop/paste spec with a
 *                 non-empty `types` MIME filter, else 1.
 *
 *  Identical tuples fall back to registration order in the matcher's
 *  stable sort, preserving the pre-specificity tiebreaker. */
export function specificity(
  spec: GestureSpec,
): readonly [number, number, number, number] {
  const t = targetRank('target' in spec ? spec.target : undefined);
  const mods = ('mods' in spec ? spec.mods : undefined) as ModSpec | undefined;
  const m = modsCount(mods);
  const p = ('phase' in spec && spec.phase !== undefined) ? 1 : 0;
  // Per-kind tiebreak: a MIME-typed drop/paste spec beats an untyped one
  // in the same scope (a consumer's `types: ['text/csv']` binding should
  // win over the kit's catch-all ingest binding).
  const typed =
    (spec.kind === 'drop' || spec.kind === 'paste') &&
    spec.types !== undefined && spec.types.length > 0
      ? 2 : 1;
  return [t, m, p, typed];
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
 * Within a scope, more-specific bindings win; same-specificity bindings keep
 * registration order (see `matchSorted`).
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
  warn: (message: string) => void = (m) => console.warn(m),
): MatchResult[] {
  const out: MatchResult[] = [];
  const engaged = engagedChannels ?? EMPTY_ENGAGED;
  // An exclusive claim outranks the scope tier. Scope is the outermost sort
  // key below, so without this a vague active binding beats the claim owner's
  // precise ambient one — the whole reason chrome got swallowed by whichever
  // tool was active.
  const exclusive = isExclusiveClaim(e);
  const pool = exclusive
    ? bindings.filter(sb => targetConsultsAffordance(specTargetOf(sb.binding.spec)))
    : bindings;
  for (const scope of SCOPE_PRIORITY) {
    const scopeMatches: MatchResult[] = [];
    for (const sb of pool) {
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
  // Checked against the final result, not the pool: a binding can declare a
  // `kindOf`/`affordance:` target and still fail to match this particular
  // claim, which used to read as "handled" even though nothing fired.
  if (exclusive && out.length === 0 && bindings.length > 0) {
    reportDeadClaim(claimOf(e)?.owner, warn);
  }
  return out;
}

const EMPTY_ENGAGED: ReadonlySet<string> = new Set();
