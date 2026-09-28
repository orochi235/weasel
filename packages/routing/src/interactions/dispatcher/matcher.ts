/**
 * Pure matcher primitives live in `@weasel-js/gestures`. This file
 * re-exports them for kit-internal consumers and layers the actions-layer
 * binding-scope / matchBest logic on top.
 */

import { matchSpec, matchModifiers, matchKey, matchTarget, matchPhase, parseTargetSpec, specificity } from '@weasel-js/gestures';
import type {
  GestureSpec, InputEvent, PhaseContext, TargetSpec,
} from '@weasel-js/gestures';
import type { GestureBinding } from '../actions/binding';
import type { ClaimableGesture } from '@weasel-js/gestures';
import { isDev } from '../../devFlag';

export { matchSpec, matchModifiers, matchKey, matchTarget, matchPhase, specificity };
export type { InputEvent, PhaseContext };

// ---------------------------------------------------------------------------
// BindingScope / ScopedBinding / MatchResult
// ---------------------------------------------------------------------------

/** Where a binding came from, which is also its priority: a held hotkey beats
 *  the active tool, which beats bindings that are always in scope. */
export type BindingScope = 'ambient' | 'active' | 'hotkey';

/** A binding paired with where it came from, ready to be matched against an
 *  event. */
export interface ScopedBinding {
  binding: GestureBinding;
  scope: BindingScope;
  /** Id of the tool or contribution that declared this binding —
   *  `'&'`-channel phase atoms resolve to it. `null` for a registered
   *  action's own binding. */
  ownerId: string | null;
}

/** The binding that won a match. */
export interface MatchResult {
  binding: GestureBinding;
  scope: BindingScope;
  /** Id of the entry that declared the binding — propagated from
   *  `ScopedBinding` so the dispatcher can record it as the handle owner. */
  ownerId: string | null;
}

// ---------------------------------------------------------------------------
// matchBest / matchSorted
// ---------------------------------------------------------------------------

const SCOPE_PRIORITY: readonly BindingScope[] = ['hotkey', 'active', 'ambient'];

// ---------------------------------------------------------------------------
// Binding specificity
// ---------------------------------------------------------------------------

/**
 * True when a spec's target actually consults the affordance hit rather than
 * only the body classification. `kindOf` predicates are handed the hit;
 * `affordance:<k>` matches on its `kind`. The body-class strings (`'empty'`,
 * `'selected-body'`, `'unselected-body'`) and the `kind:` forms resolve from
 * `bodyTarget` / `bodyKind` and never see it — which is why chrome floating
 * over empty canvas used to read as empty canvas.
 *
 * A predicate carrying `readsAffordance: false` says the same about itself;
 * the kit's own body predicates do. Shape stays the fallback for predicates
 * that declare nothing.
 */
export function targetConsultsAffordance(specTarget: TargetSpec | undefined): boolean {
  if (specTarget === undefined) return false;
  const form = parseTargetSpec(specTarget);
  if (form === null) return false;
  switch (form.form) {
    case 'predicate': return form.kindOf.readsAffordance !== false;
    case 'affordance': return true;
    case 'body': return false;
    case 'kind': return false;
    default: {
      const _exhaustive: never = form;
      void _exhaustive;
      return false;
    }
  }
}

function specTargetOf(spec: GestureSpec): TargetSpec | undefined {
  return 'target' in spec ? spec.target : undefined;
}

interface Claim {
  owner?: string;
  strength?: 'exclusive' | 'shared';
  claimedKinds?: readonly ClaimableGesture[];
}

function claimOf(e: InputEvent): Claim | undefined {
  return ('affordance' in e ? e.affordance : undefined) as Claim | undefined;
}

/** Event kind → the claim token that covers it. `null` for events a positional
 *  claim has no opinion about — keys, drops, pastes, multitouch. */
function claimGestureOf(e: InputEvent): ClaimableGesture | null {
  switch (e.kind) {
    case 'pointerdown':
    case 'click': return 'pointer';
    case 'doubleclick': return 'doubleClick';
    case 'contextmenu': return 'contextMenu';
    case 'longpress': return 'longPress';
    case 'wheel': return 'wheel';
    case 'pinch': return 'pinch';
    default: return null;
  }
}

/** `'exclusive'` when the event carries a claim that bars unnamed bindings
 *  for this event's gesture. */
function isExclusiveClaim(e: InputEvent): boolean {
  const claim = claimOf(e);
  if (claim?.strength !== 'exclusive') return false;
  const gesture = claimGestureOf(e);
  if (gesture === null) return false;
  return claim.claimedKinds === undefined || claim.claimedKinds.includes(gesture);
}

const warnedDeadClaims = new Set<string>();

/** Dev-only. An exclusive claim that matches no binding drops the press with
 *  no diagnostic, which reads exactly like deliberate blocking. */
function reportDeadClaim(owner: string | undefined, warn: (message: string) => void): void {
  if (!isDev()) return;
  const key = String(owner);
  if (warnedDeadClaims.has(key)) return;
  warnedDeadClaims.add(key);
  warn(
    `[weasel] exclusive claim by "${key}" matched no binding: no `
    + '`affordance:` or `kindOf` target resolved against it, so the press was dropped.',
  );
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
  return matchSortedWithBarred(e, bindings, isMac, engagedChannels, { warn }).matches;
}

/** {@link matchSorted}, plus what an exclusive claim on the event barred. */
export interface MatchOutcome {
  matches: MatchResult[];
  /** Bindings whose spec matched the event but which the claim barred, in
   *  the same order `matches` uses. Filled only when `collectBarred` is set. */
  barred: MatchResult[];
  /** Owner of the exclusive claim, when one applied. */
  claimOwner?: string;
}

/**
 * {@link matchSorted} that can also report the bindings an exclusive claim
 * kept out. Collecting them costs a spec match per barred binding, so it is
 * opt-in — the dispatcher asks only when it is recording.
 */
export function matchSortedWithBarred(
  e: InputEvent,
  bindings: readonly ScopedBinding[],
  isMac: boolean,
  engagedChannels?: ReadonlySet<string>,
  opts: { collectBarred?: boolean; warn?: (message: string) => void } = {},
): MatchOutcome {
  const warn = opts.warn ?? ((m: string) => console.warn(m));
  const engaged = engagedChannels ?? EMPTY_ENGAGED;
  // An exclusive claim outranks the scope tier. Scope is the outermost sort
  // key below, so without this a vague active binding beats the claim owner's
  // precise ambient one — the whole reason chrome got swallowed by whichever
  // tool was active.
  const exclusive = isExclusiveClaim(e);
  const admits = (sb: ScopedBinding): boolean =>
    !exclusive || targetConsultsAffordance(specTargetOf(sb.binding.spec));
  const out: MatchResult[] = [];
  const barred: MatchResult[] = [];
  for (const scope of SCOPE_PRIORITY) {
    const scopeMatches: MatchResult[] = [];
    const scopeBarred: MatchResult[] = [];
    for (const sb of bindings) {
      if (sb.scope !== scope) continue;
      const admitted = admits(sb);
      if (!admitted && !opts.collectBarred) continue;
      const phaseCtx: PhaseContext = { selfChannel: sb.ownerId, engagedChannels: engaged };
      if (matchSpec(e, sb.binding.spec, isMac, phaseCtx)) {
        (admitted ? scopeMatches : scopeBarred)
          .push({ binding: sb.binding, scope, ownerId: sb.ownerId });
      }
    }
    // Stable sort by specificity descending. Identical-specificity entries
    // keep their registration order (Array.prototype.sort is stable per ES2019).
    scopeMatches.sort((a, b) => compareSpecificity(a.binding.spec, b.binding.spec));
    scopeBarred.sort((a, b) => compareSpecificity(a.binding.spec, b.binding.spec));
    out.push(...scopeMatches);
    barred.push(...scopeBarred);
  }
  // Checked against the final result, not the pool: a binding can declare a
  // `kindOf`/`affordance:` target and still fail to match this particular
  // claim, which used to read as "handled" even though nothing fired.
  if (exclusive && out.length === 0 && bindings.length > 0) {
    reportDeadClaim(claimOf(e)?.owner, warn);
  }
  const owner = exclusive ? claimOf(e)?.owner : undefined;
  return { matches: out, barred, ...(owner !== undefined ? { claimOwner: owner } : {}) };
}

const EMPTY_ENGAGED: ReadonlySet<string> = new Set();
