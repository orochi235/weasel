/**
 * Pure gesture matcher — no React, no state, no DOM.
 *
 * Used by the dispatcher orchestrator (Task 3) to decide which GestureBinding
 * fires for a given input event.
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

import type { GestureSpec, ModSpec } from '../gestures/spec';
import type { GestureBinding } from '../actions/binding';
import type { AffordanceHit } from '../actions/invoker';

// ---------------------------------------------------------------------------
// InputEvent
// ---------------------------------------------------------------------------

/** Normalized input-event shape. Discriminated by `kind`. Includes only
 *  the fields the matcher cares about; the React seam (Task 4) builds
 *  these from real DOM events.
 *
 *  Pump-only events (`pointermove`, `pointerup`, `pointercancel`) are not
 *  matched by `matchSpec` — they are routed directly to in-flight handles by
 *  the dispatcher's pump path. They share the same type union so the
 *  dispatcher's `handleInput` signature stays uniform. */
export type InputEvent =
  | { kind: 'key'; key: string; altKey: boolean; ctrlKey: boolean; metaKey: boolean; shiftKey: boolean; repeat?: boolean }
  | { kind: 'key-held'; key: string; phase: 'down' | 'up'; altKey: boolean; ctrlKey: boolean; metaKey: boolean; shiftKey: boolean }
  | { kind: 'wheel'; altKey: boolean; ctrlKey: boolean; metaKey: boolean; shiftKey: boolean; deltaX: number; deltaY: number; clientX: number; clientY: number }
  | {
      kind: 'pointerdown';
      target?: unknown;
      x?: number;
      y?: number;
      altKey: boolean;
      ctrlKey: boolean;
      metaKey: boolean;
      shiftKey: boolean;
      affordance?: AffordanceHit;
      /**
       * Body-target classification from the scene hit-test.
       * Populated by `useGestureDispatcher` when a `classifyTarget` thunk is
       * supplied to its options. Used by `matchTarget` to resolve string-form
       * `TargetSpec` values (`'empty'`, `'selected-body'`, `'unselected-body'`).
       * Absent when `classifyTarget` is not wired.
       */
      bodyTarget?: 'empty' | 'selected-body' | 'unselected-body';
    }
  | { kind: 'pointermove'; x: number; y: number; altKey: boolean; ctrlKey: boolean; metaKey: boolean; shiftKey: boolean }
  | { kind: 'pointerup'; x: number; y: number; altKey: boolean; ctrlKey: boolean; metaKey: boolean; shiftKey: boolean }
  | { kind: 'pointercancel'; altKey: boolean; ctrlKey: boolean; metaKey: boolean; shiftKey: boolean }
  | {
      kind: 'click';
      target?: unknown;
      altKey: boolean;
      ctrlKey: boolean;
      metaKey: boolean;
      shiftKey: boolean;
      /**
       * Body-target classification from the scene hit-test.
       * Populated by `useGestureDispatcher` when a `classifyTarget` thunk is
       * supplied. Used by `matchTarget` to resolve string-form `TargetSpec`
       * values (`'empty'`, `'selected-body'`, `'unselected-body'`).
       * Absent when `classifyTarget` is not wired.
       */
      bodyTarget?: 'empty' | 'selected-body' | 'unselected-body';
    }
  | {
      kind: 'multitouch';
      fingers: number;
      altKey: boolean;
      ctrlKey: boolean;
      metaKey: boolean;
      shiftKey: boolean;
      /**
       * Centroid of active pointers in screen space. Populated by
       * `useGestureDispatcher` when the event is a pointermove-pump of a
       * running multitouch handle (i.e. `centroid` is updated each frame).
       * Absent on the initial pointerdown-triggered multitouch event.
       */
      centroid?: { x: number; y: number };
      /**
       * Distance between the two primary pointers (screen space). Populated
       * on move-pump events alongside `centroid`. Absent on initial event.
       */
      spread?: number;
    };

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
// matchModifiers
// ---------------------------------------------------------------------------

type ModifiersEvent = { altKey: boolean; ctrlKey: boolean; metaKey: boolean; shiftKey: boolean };

/**
 * Strict modifier match.
 *
 * - Omitted modifier MUST NOT be held.
 * - `true` means MUST be held.
 * - `false` means MUST NOT be held (same as omitted; both forms accepted for clarity).
 * - `shift: 'optional'` accepts either shifted or unshifted.
 * - `mod: true` matches `metaKey` on mac, `ctrlKey` elsewhere. When `mod` is set,
 *   the corresponding `meta`/`ctrl` field is implied and the *other* platform key
 *   must NOT be held. Callers should not combine `mod` with `meta`/`ctrl`.
 */
export function matchModifiers(
  e: ModifiersEvent,
  mods: ModSpec | undefined,
  isMac: boolean,
): boolean {
  // Resolve effective requirements for each of the four physical keys.
  // We compute required/forbidden state for: alt, ctrl, meta, shift.

  // Start with strict defaults: all modifiers must be absent.
  let requireAlt = false;
  let requireCtrl = false;
  let requireMeta = false;
  let requireShift: boolean | 'optional' = false;

  if (mods) {
    // alt
    if (mods.alt === true) requireAlt = true;
    // else: false/undefined → must be absent (requireAlt stays false)

    // shift
    if (mods.shift === true) requireShift = true;
    else if (mods.shift === 'optional') requireShift = 'optional';
    // else: false/undefined → must be absent

    // mod: platform-aware shorthand for the primary command modifier
    if (mods.mod === true) {
      if (isMac) {
        requireMeta = true;
        // ctrlKey must NOT be held (handled below via strict check)
      } else {
        requireCtrl = true;
        // metaKey must NOT be held (handled below via strict check)
      }
    } else {
      // No mod shorthand — handle explicit meta/ctrl
      if (mods.meta === true) requireMeta = true;
      if (mods.ctrl === true) requireCtrl = true;
    }
  }

  // Now validate each physical key:

  // alt
  if (requireAlt) {
    if (!e.altKey) return false;
  } else {
    if (e.altKey) return false;
  }

  // ctrl
  if (requireCtrl) {
    if (!e.ctrlKey) return false;
  } else {
    if (e.ctrlKey) return false;
  }

  // meta
  if (requireMeta) {
    if (!e.metaKey) return false;
  } else {
    if (e.metaKey) return false;
  }

  // shift
  if (requireShift === true) {
    if (!e.shiftKey) return false;
  } else if (requireShift === false) {
    if (e.shiftKey) return false;
  }
  // 'optional': no constraint

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
// matchTarget (internal helper)
// ---------------------------------------------------------------------------

/**
 * Match a target value + event against a TargetSpec.
 *
 * - `{ kindOf: predicate }` — calls the predicate with the raw target value.
 *   For pointerdown events this is the affordance hit (AffordanceHit | undefined);
 *   for other events it is whatever `target` was set to.
 * - `'empty'`, `'selected-body'`, `'unselected-body'` — compared against
 *   `bodyTarget` on the event (populated by `useGestureDispatcher` when a
 *   `classifyTarget` thunk is supplied). Falls back to `false` when absent
 *   (kind registry not yet wired).
 * - Other string-forms (`kind:*`, `affordance:*`) — not yet supported; return false.
 * - `undefined` spec.target — any target is accepted.
 */
function matchTarget(target: unknown, specTarget: unknown, bodyTarget?: string): boolean {
  if (specTarget === undefined) return true;

  // kindOf predicate form — receives the raw target (affordance hit for drag, etc.)
  if (
    typeof specTarget === 'object' &&
    specTarget !== null &&
    'kindOf' in specTarget &&
    typeof (specTarget as { kindOf: unknown }).kindOf === 'function'
  ) {
    return (specTarget as { kindOf: (t: unknown) => boolean }).kindOf(target);
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
): boolean {
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
      const direction = spec.direction ?? 'both';
      if (direction === 'up' && !(e.deltaY < 0)) return false;
      if (direction === 'down' && !(e.deltaY > 0)) return false;
      return true;
    }

    case 'click': {
      if (e.kind !== 'click') return false;
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

    default: {
      // Exhaustiveness guard — new spec kinds are a compile error here.
      const _exhaustive: never = spec;
      void _exhaustive;
      return false;
    }
  }
}

// ---------------------------------------------------------------------------
// matchBest
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
