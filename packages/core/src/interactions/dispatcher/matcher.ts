/**
 * Pure matcher primitives live in `@weasel-js/gestures`. This file
 * re-exports them for kit-internal consumers and layers the actions-layer
 * binding-scope / matchBest logic on top.
 */

import { matchSpec, matchModifiers, matchKey, matchTarget, matchPhase, parseTargetSpec } from '@weasel-js/gestures';
import type {
  GestureSpec, InputEvent, ModSpec, PhaseAtom, PhaseContext, PhaseSpec, TargetSpec,
} from '@weasel-js/gestures';
import type { GestureBinding } from '../actions/binding';
import type { ClaimableGesture } from '../../affordances/types';

export { matchSpec, matchModifiers, matchKey, matchTarget, matchPhase };
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
  /** Tool id that owns this binding — `'&'`-channel phase atoms resolve
   *  to this. `null` for ambient bindings that came from a registered
   *  Action with no owning tool. */
  ownerToolId: string | null;
}

/** The binding that won a match. */
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
function targetRank(target: TargetSpec | undefined): number {
  if (target === undefined) return 0;
  const form = parseTargetSpec(target);
  if (form === null) return 1;
  switch (form.form) {
    case 'kind': return form.requireSelected ? 3 : 2;
    case 'affordance': return 2;
    case 'body': return 1;
    case 'predicate': return 1;
    default: {
      const _exhaustive: never = form;
      void _exhaustive;
      return 1;
    }
  }
}

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
  if (process.env.NODE_ENV === 'production') return;
  const key = String(owner);
  if (warnedDeadClaims.has(key)) return;
  warnedDeadClaims.add(key);
  warn(
    `[weasel] exclusive claim by "${key}" matched no binding: no `
    + '`affordance:` or `kindOf` target resolved against it, so the press was dropped.',
  );
}

/**
 * Rank a `PhaseSpec` by how much it narrows, on the same graduated principle
 * as `targetRank`. A phase atom constrains two axes — which channel, and its
 * lifecycle state — and each may be wildcarded:
 *
 *    2 — both concrete: `{ channel: '&' | '<toolId>', phase: 'initial' }`,
 *        which is also what the bare-keyword shorthand desugars to
 *    1 — one axis wildcarded: `{ channel: '*', phase: 'engaged' }`
 *    0 — `{ channel: '*', phase: '*' }`, or no `phase` field at all
 *
 * The `*:*` case scoring 0 is the point: it matches everything `matchPhase`
 * would have matched with no spec, so grading it above an undeclared phase
 * would let a binding buy precedence with a constraint that constrains
 * nothing — CSS's `:where()` problem.
 *
 * An atom list is a union (`matchPhase` returns true when ANY atom matches),
 * so the list is as broad as its broadest atom and takes the **minimum**.
 *
 * Compat: every phase-bearing spec in the tree keeps its score or rises, and
 * none reorders. The four ambient actions (`escape`, `delete`,
 * `anchorEditing`, `cancelGesture`) all declare `{ channel: '*', phase:
 * <concrete> }` and stay at 1; the polygon and star tools' `phase: 'engaged'`
 * wheel bindings desugar to a concrete `&` atom and rise 1 → 2, which only
 * widens a gap they already won. Nothing in the tree declares `*:*`.
 */
function phaseRank(spec: PhaseSpec | undefined): number {
  if (spec === undefined) return 0;
  const atoms = typeof spec === 'string'
    ? [{ channel: '&', phase: spec } as PhaseAtom]
    : spec;
  if (atoms.length === 0) return 0;
  let min = 2;
  for (const a of atoms) {
    const rank = (a.channel === '*' ? 0 : 1) + (a.phase === '*' ? 0 : 1);
    if (rank < min) min = rank;
  }
  return min;
}

/** CSS-style specificity tuple for a GestureSpec. Higher tuple wins under
 *  lexicographic compare. Dimensions, in order of precedence:
 *
 *    [0] target — how much the spec's target narrows; see `targetRank`.
 *    [1] mods   — count of required modifier keys (shift/alt/ctrl/meta/mod).
 *                 `'optional'` does NOT count.
 *    [2] phase  — how much the spec's `phase` narrows; see `phaseRank`.
 *    [3] exact  — per-kind tiebreak: 2 for a drop/paste spec with a
 *                 non-empty `types` MIME filter, else 1.
 *
 *  Identical tuples fall back to registration order in the matcher's
 *  stable sort, preserving the pre-specificity tiebreaker. */
export function specificity(
  spec: GestureSpec,
): readonly [number, number, number, number] {
  const t = targetRank(specTargetOf(spec));
  const mods = ('mods' in spec ? spec.mods : undefined) as ModSpec | undefined;
  const m = modsCount(mods);
  const p = phaseRank(('phase' in spec ? spec.phase : undefined) as PhaseSpec | undefined);
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
