/**
 * Pure gesture matcher — no React, no state, no DOM.
 *
 * The kit's dispatcher orchestrator wraps these primitives with its
 * actions-layer concerns (BindingScope, ScopedBinding, MatchResult, matchBest).
 *
 * ## key-held phase decision
 * `matchSpec` returns `true` only for `phase: 'down'`, not `phase: 'up'`.
 * The dispatcher tracks the held key independently and handles the `up` phase
 * itself; the matcher never sees an "un-match" it needs to distinguish.
 * This keeps the matcher's output a simple boolean and avoids a three-valued
 * return type.
 *
 * ## TargetSpec string-form decision
 * String-form TargetSpec values ('empty', 'selected-body', `kind:*`, etc.) are
 * sugar for the kit-owned object-kind registry, which hasn't shipped yet
 * (see docs/TODO.md Tier 1). Phase 3 returns `false` for any string-form
 * target spec so that callers get an explicit no-match rather than a silent
 * wildcard or a runtime throw.
 */

import type { GestureSpec, ModSpec, PhaseSpec } from './spec';
import type { InputEvent } from './inputEvent';
import type { PhaseAtom } from '../grammar/routeGrammar';

// ---------------------------------------------------------------------------
// matchModifiers
// ---------------------------------------------------------------------------

export type ModifiersEvent = { altKey: boolean; ctrlKey: boolean; metaKey: boolean; shiftKey: boolean };

/** Per-physical-key requirement resolved from a `ModSpec`:
 *  - `'required'`  — the key MUST be held
 *  - `'forbidden'` — the key MUST NOT be held
 *  - `'optional'`  — either is accepted
 */
type KeyRequirement = 'required' | 'forbidden' | 'optional';

function resolveSpecValue(value: boolean | 'optional' | undefined): KeyRequirement {
  if (value === true) return 'required';
  if (value === 'optional') return 'optional';
  return 'forbidden';
}

/**
 * Strict modifier match.
 *
 * - Omitted modifier MUST NOT be held.
 * - `true`       MUST be held.
 * - `false`      MUST NOT be held (same as omitted; both forms accepted for clarity).
 * - `'optional'` accepts either held or unheld. Supported on every modifier
 *   (`alt`, `ctrl`, `meta`, `mod`, `shift`).
 * - `mod` is platform-aware: matches `metaKey` on mac, `ctrlKey` elsewhere.
 *   When `mod` is set, the corresponding `meta`/`ctrl` field is implied AND
 *   the *other* platform key is forbidden. Callers should not combine `mod`
 *   with `meta`/`ctrl`.
 */
export function matchModifiers(
  e: ModifiersEvent,
  mods: ModSpec | undefined,
  isMac: boolean,
): boolean {
  // Start strict: every modifier is forbidden unless the spec opts in.
  let alt: KeyRequirement = 'forbidden';
  let ctrl: KeyRequirement = 'forbidden';
  let meta: KeyRequirement = 'forbidden';
  let shift: KeyRequirement = 'forbidden';

  if (mods) {
    alt = resolveSpecValue(mods.alt);
    shift = resolveSpecValue(mods.shift);

    // mod: platform-aware shorthand. Resolves to meta on mac, ctrl elsewhere.
    // The *other* platform key stays forbidden (handled by the strict default).
    if (mods.mod !== undefined) {
      const modReq = resolveSpecValue(mods.mod);
      if (isMac) meta = modReq;
      else ctrl = modReq;
    } else {
      meta = resolveSpecValue(mods.meta);
      ctrl = resolveSpecValue(mods.ctrl);
    }
  }

  return (
    checkKey(alt,   e.altKey) &&
    checkKey(ctrl,  e.ctrlKey) &&
    checkKey(meta,  e.metaKey) &&
    checkKey(shift, e.shiftKey)
  );
}

function checkKey(req: KeyRequirement, held: boolean): boolean {
  if (req === 'required') return held;
  if (req === 'forbidden') return !held;
  return true;
}

// ---------------------------------------------------------------------------
// matchKey
// ---------------------------------------------------------------------------

/** Case-insensitive key match; supports string or string[] (any-of). */
export function matchKey(eventKey: string, specKey: string | string[]): boolean {
  const lower = eventKey.toLowerCase();
  if (Array.isArray(specKey)) {
    return specKey.some((k) => k.toLowerCase() === lower);
  }
  return specKey.toLowerCase() === lower;
}

// ---------------------------------------------------------------------------
// matchTarget
// ---------------------------------------------------------------------------

/**
 * Match a target value + event against a TargetSpec.
 *
 * - `{ kindOf: predicate }` — calls the predicate with the raw target value
 *   (affordance hit on pointerdown; event.target otherwise) AND the
 *   `bodyTarget` string. Predicates that only need the target can ignore
 *   the second arg.
 * - `'empty'`, `'selected-body'`, `'unselected-body'` — compared against
 *   `bodyTarget` on the event (populated by `useGestureDispatcher` when a
 *   `classifyTarget` thunk is supplied). Falls back to `false` when absent
 *   (kind registry not yet wired).
 * - Other string-forms (`kind:*`, `affordance:*`) — not yet supported; return false.
 * - `undefined` spec.target — any target is accepted.
 */
export function matchTarget(target: unknown, specTarget: unknown, bodyTarget?: string): boolean {
  if (specTarget === undefined) return true;

  // kindOf predicate form — receives the raw target (affordance hit for
  // drag, e.target otherwise) plus the bodyTarget classification.
  if (
    typeof specTarget === 'object' &&
    specTarget !== null &&
    'kindOf' in specTarget &&
    typeof (specTarget as { kindOf: unknown }).kindOf === 'function'
  ) {
    return (specTarget as { kindOf: (t: unknown, bodyTarget?: string) => boolean }).kindOf(target, bodyTarget);
  }

  // String-form: 'empty', 'selected-body', 'unselected-body'
  // Resolved from the `classifyTarget` result packed into the event's `bodyTarget`.
  if (
    specTarget === 'empty' ||
    specTarget === 'selected-body' ||
    specTarget === 'unselected-body'
  ) {
    // When classifyTarget isn't wired, bodyTarget is absent → no match.
    if (bodyTarget === undefined) return false;
    return bodyTarget === specTarget;
  }

  // Other string-forms (kind:*, affordance:*) — not yet supported.
  return false;
}

// ---------------------------------------------------------------------------
// matchPhase
// ---------------------------------------------------------------------------

/** Per-tool gesture-lifecycle state at match time.
 *
 *  - `selfChannel` is the tool id `'&'` resolves to — i.e., the tool that
 *    owns the binding being evaluated. `null` for bindings without an
 *    owning tool (e.g. ambient actions registered without scope ties); in
 *    that case any `phase: '&'` atom can't match.
 *  - `engagedChannels` is the set of tool ids that currently have an
 *    in-flight handle. Derived by the dispatcher from its `inFlight()`
 *    map keyed by tool id at match time.
 */
export interface PhaseContext {
  selfChannel: string | null;
  engagedChannels: ReadonlySet<string>;
}

/** Normalize the `PhaseSpec` shorthand to an atom array.
 *  Bare keywords desugar to a single `'&'`-channel atom. */
function normalizePhase(spec: PhaseSpec): readonly PhaseAtom[] {
  if (typeof spec === 'string') {
    return [{ channel: '&', phase: spec }];
  }
  return spec;
}

/** True if the binding's `phase` spec is satisfied by the current
 *  per-tool engagement state. Omitted spec → always true (no phase
 *  constraint). Union semantics: a phase atom list matches when ANY
 *  atom matches. */
export function matchPhase(spec: PhaseSpec | undefined, ctx: PhaseContext): boolean {
  if (spec === undefined) return true;
  const atoms = normalizePhase(spec);
  if (atoms.length === 0) return true;
  for (const a of atoms) {
    if (matchPhaseAtom(a, ctx)) return true;
  }
  return false;
}

function matchPhaseAtom(a: PhaseAtom, ctx: PhaseContext): boolean {
  if (a.channel === '*') {
    // Any-channel sentinel: 'engaged' matches when any channel is engaged;
    // 'initial' matches when none are; '*' matches both.
    if (a.phase === '*') return true;
    const anyEngaged = ctx.engagedChannels.size > 0;
    return a.phase === 'engaged' ? anyEngaged : !anyEngaged;
  }
  // Resolve '&' to the binding's owning tool. Without an owner, '&' atoms
  // can't match (correct: ambient actions don't have a "self").
  const id = a.channel === '&' ? ctx.selfChannel : a.channel;
  if (id == null) return false;
  if (a.phase === '*') return true;
  const isEngaged = ctx.engagedChannels.has(id);
  return a.phase === 'engaged' ? isEngaged : !isEngaged;
}

// ---------------------------------------------------------------------------
// matchSpec
// ---------------------------------------------------------------------------

/**
 * Match a single GestureSpec against an InputEvent.
 *
 * For `key-held`, only `phase: 'down'` returns true. The dispatcher tracks the
 * held state independently and handles `phase: 'up'` itself.
 *
 * For TargetSpec string forms, returns false (kind registry not yet available).
 */
export function matchSpec(
  e: InputEvent,
  spec: GestureSpec,
  isMac: boolean,
  phaseCtx?: PhaseContext,
): boolean {
  // Phase gate runs first — cheaper than the per-kind logic, and a failed
  // phase rules the spec out regardless of event shape. When no phase ctx
  // is supplied (legacy callers), treat as wildcard-engagement so existing
  // bindings continue to behave as if phase weren't a constraint.
  if (spec.phase !== undefined) {
    const ctx: PhaseContext = phaseCtx ?? { selfChannel: null, engagedChannels: EMPTY_ENGAGED };
    if (!matchPhase(spec.phase, ctx)) return false;
  }

  switch (spec.kind) {
    case 'key': {
      if (e.kind !== 'key') return false;
      if (!matchKey(e.key, spec.key)) return false;
      return matchModifiers(e, spec.mods, isMac);
    }

    case 'key-held': {
      if (e.kind !== 'key-held') return false;
      if (e.phase !== 'down') return false; // only match the down phase
      if (!matchKey(e.key, spec.key)) return false;
      return matchModifiers(e, spec.mods, isMac);
    }

    case 'wheel': {
      if (e.kind !== 'wheel') return false;
      if (!matchModifiers(e, spec.mods, isMac)) return false;
      const direction = spec.direction ?? '*';
      if (direction === 'up' && !(e.deltaY < 0)) return false;
      if (direction === 'down' && !(e.deltaY > 0)) return false;
      return true;
    }

    case 'click': {
      if (e.kind !== 'click') return false;
      if (!matchModifiers(e, spec.mods, isMac)) return false;
      return matchTarget(e.target, spec.target, e.bodyTarget);
    }

    case 'doubleClick': {
      if (e.kind !== 'doubleclick') return false;
      if (!matchModifiers(e, spec.mods, isMac)) return false;
      return matchTarget(e.target, spec.target, e.bodyTarget);
    }

    case 'contextMenu': {
      if (e.kind !== 'contextmenu') return false;
      if (!matchModifiers(e, spec.mods, isMac)) return false;
      return matchTarget(e.target, spec.target, e.bodyTarget);
    }

    case 'drag': {
      // Drag begins at pointerdown; the dispatcher promotes to drag after
      // threshold is crossed. The matcher fires on pointerdown.
      if (e.kind !== 'pointerdown') return false;
      if (!matchModifiers(e, spec.mods, isMac)) return false;
      // Pass the affordance hit as the `target` for `kindOf` predicates.
      // Pass `bodyTarget` for string-form TargetSpec values.
      return matchTarget(e.affordance, spec.target, e.bodyTarget);
    }

    case 'multiTouch': {
      if (e.kind !== 'multitouch') return false;
      if (e.fingers !== spec.fingers) return false;
      return matchModifiers(e, spec.mods, isMac);
    }

    case 'multiTouchTap': {
      if (e.kind !== 'multitouchtap') return false;
      if (e.fingers !== spec.fingers) return false;
      return matchModifiers(e, spec.mods, isMac);
    }

    default: {
      // Exhaustiveness guard — new spec kinds are a compile error here.
      const _exhaustive: never = spec;
      void _exhaustive;
      return false;
    }
  }
}

const EMPTY_ENGAGED: ReadonlySet<string> = new Set();
