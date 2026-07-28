/**
 * Synthesize an `InputEvent` from the Resolution widget's pickers.
 *
 * Kept out of the component so the synthesis rules are unit-testable without
 * rendering, and so the honesty boundary is stated in one place:
 *
 *  - A body target (`empty` / `selected-body` / `unselected-body`) sets
 *    `bodyTarget` and leaves `affordance` undefined. Predicates evaluate
 *    TRUTHFULLY against this — `isAnchorOrControl(undefined)` is a real
 *    `false`, not a guess. This is the "press landed on the scene" case.
 *  - An `affordance:<kind>` target synthesizes a minimal `{ kind }`
 *    `AffordanceHit`. Most kit predicates discriminate on `kind` alone, so
 *    those also evaluate truthfully. A predicate reading `payload`,
 *    `targetIds`, or `anchor` cannot be satisfied this way — which is why the
 *    widget badges predicate-target rows rather than claiming certainty.
 *
 * Event-shape notes (verified against `packages/gestures/src/ui/inputEvent.ts`
 * and `.../ui/match.ts` — see those files for the authoritative arm shapes):
 *
 *  - There is no `kind: 'drag'` `InputEvent` arm. A `drag` `GestureSpec`
 *    matches a `pointerdown` event whose `stage` is NOT `'press'` — the
 *    dispatcher promotes to drag after the movement threshold, but the
 *    matcher itself fires on the (non-eager) pointerdown dispatch.
 *  - A `pointerDown` spec matches the OTHER dispatch of the same physical
 *    press: `kind: 'pointerdown'` with `stage: 'press'`.
 *  - `click`/`drag`/`pointerDown` specs run their `kindOf` predicate against
 *    `event.affordance` (see `matchTarget(e.affordance, spec.target, ...)`
 *    in match.ts). `doubleClick`/`contextMenu` specs run it against
 *    `event.target` instead — those event shapes have no `affordance` field
 *    at all.
 */
import type { InputEvent, BodyTarget, EventModifiers } from '@weasel-js/gestures';

/** Gesture kinds the picker offers. */
export const RESOLUTION_GESTURES = [
  'click', 'doubleClick', 'pointerDown', 'drag', 'wheel', 'key', 'contextMenu',
] as const;
export type ResolutionGesture = (typeof RESOLUTION_GESTURES)[number];

export const RESOLUTION_BODY_TARGETS = ['empty', 'selected-body', 'unselected-body'] as const;
export type ResolutionBodyTarget = (typeof RESOLUTION_BODY_TARGETS)[number];

/** `affordance:` prefix marks a chrome target in the picker's flat list. */
export const AFFORDANCE_PREFIX = 'affordance:';

export interface ResolutionMods {
  shift?: boolean;
  alt?: boolean;
  meta?: boolean;
  ctrl?: boolean;
}

export interface ResolutionInput {
  gesture: ResolutionGesture;
  /** A body target, or `affordance:<kind>` for chrome. */
  target: string;
  mods: ResolutionMods;
  /** For `key` gestures. Ignored otherwise. */
  key?: string;
}

/** Resolve the picker's flat `target` string into the field(s) that
 *  `matchTarget` actually reads for a given event shape: either a
 *  synthesized `{ kind }` hit (chrome) or a `bodyTarget` classification
 *  (scene). Mutually exclusive — see the module doc for why. */
function resolveTarget(target: string): { hit?: { kind: string }; bodyTarget?: BodyTarget } {
  if (target.startsWith(AFFORDANCE_PREFIX)) {
    return { hit: { kind: target.slice(AFFORDANCE_PREFIX.length) } };
  }
  // Caller is expected to have picked this from RESOLUTION_BODY_TARGETS.
  return { bodyTarget: target as BodyTarget };
}

function modifiers(mods: ResolutionMods): EventModifiers {
  return {
    altKey: !!mods.alt,
    ctrlKey: !!mods.ctrl,
    metaKey: !!mods.meta,
    shiftKey: !!mods.shift,
  };
}

export function synthesizeInput(input: ResolutionInput): InputEvent {
  const mods = modifiers(input.mods);

  switch (input.gesture) {
    case 'key': {
      return { kind: 'key', ...mods, key: input.key ?? '' };
    }

    case 'wheel': {
      // Wheel specs never match on target; the picker's target selection is
      // inert for this gesture.
      return { kind: 'wheel', ...mods, deltaX: 0, deltaY: 0, clientX: 0, clientY: 0 };
    }

    case 'click': {
      // click's kindOf predicate reads `affordance`, not `target`.
      const { hit, bodyTarget } = resolveTarget(input.target);
      return { kind: 'click', ...mods, affordance: hit, bodyTarget };
    }

    case 'doubleClick': {
      // doubleClick's kindOf predicate reads `target`; there is no
      // `affordance` field on DoubleClickEvent.
      const { hit, bodyTarget } = resolveTarget(input.target);
      return { kind: 'doubleclick', ...mods, target: hit, bodyTarget };
    }

    case 'contextMenu': {
      const { hit, bodyTarget } = resolveTarget(input.target);
      return { kind: 'contextmenu', ...mods, target: hit, bodyTarget };
    }

    case 'drag': {
      // The non-eager pointerdown dispatch (stage omitted) is what a `drag`
      // spec matches. `stage` must stay unset — 'press' is reserved for the
      // pointerDown case below.
      const { hit, bodyTarget } = resolveTarget(input.target);
      return { kind: 'pointerdown', ...mods, affordance: hit, bodyTarget };
    }

    case 'pointerDown': {
      // The eager, `stage: 'press'` dispatch of the same physical press.
      const { hit, bodyTarget } = resolveTarget(input.target);
      return { kind: 'pointerdown', ...mods, stage: 'press', affordance: hit, bodyTarget };
    }
  }
}

/** Is this spec's target a `{ kindOf }` predicate rather than a named class?
 *  Drives the `?` badge — the caveat belongs on rows that can be wrong, not
 *  on rows with string targets, which need none. */
export function isPredicateTarget(spec: unknown): boolean {
  const t = (spec as { target?: unknown } | null | undefined)?.target;
  return typeof t === 'object' && t !== null && 'kindOf' in t;
}
