/**
 * Synthesize an `InputEvent` from the Resolution widget's pickers.
 *
 *  - A body target (`empty` / `selected-body` / `unselected-body`) sets
 *    `bodyTarget` and leaves `affordance` undefined, so predicates evaluate
 *    truthfully against it.
 *  - An `affordance:<kind>` target synthesizes a minimal `{ kind }`
 *    `AffordanceHit`. A predicate reading `payload`, `targetIds`, or `anchor`
 *    cannot be satisfied this way — which is why the widget badges
 *    predicate-target rows rather than claiming certainty.
 *
 * Event shapes:
 *
 *  - There is no `kind: 'drag'` `InputEvent` arm. A `drag` `GestureSpec`
 *    matches a `pointerdown` event whose `stage` is NOT `'press'`.
 *  - A `pointerDown` spec matches the OTHER dispatch of the same physical
 *    press: `kind: 'pointerdown'` with `stage: 'press'`.
 *  - `click`/`drag`/`pointerDown` specs run their `kindOf` predicate against
 *    `event.affordance`. `doubleClick`/`contextMenu` specs run it against
 *    `event.target` instead — those event shapes have no `affordance` field.
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

/** `kind:` prefix marks a node-kind target in the picker's flat list. */
export const KIND_PREFIX = 'kind:';

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

/** Resolve the picker's flat `target` string into either a synthesized
 *  `{ kind }` hit (chrome) or a body classification, never both. */
function resolveTarget(
  target: string,
): { hit?: { kind: string }; bodyTarget?: BodyTarget; bodyKind?: string } {
  if (target.startsWith(AFFORDANCE_PREFIX)) {
    return { hit: { kind: target.slice(AFFORDANCE_PREFIX.length) } };
  }
  if (target.startsWith(KIND_PREFIX)) {
    // Without `:selected` the pick is selection-agnostic, and 'unselected-body'
    // is the reading that keeps a `kind:<k>:selected` binding from matching it.
    let kind = target.slice(KIND_PREFIX.length);
    let bodyTarget: BodyTarget = 'unselected-body';
    if (kind.endsWith(':selected')) {
      kind = kind.slice(0, -':selected'.length);
      bodyTarget = 'selected-body';
    }
    return { bodyTarget, bodyKind: kind };
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
      const { hit, bodyTarget, bodyKind } = resolveTarget(input.target);
      return { kind: 'click', ...mods, affordance: hit, bodyTarget, bodyKind };
    }

    case 'doubleClick': {
      // doubleClick's kindOf predicate reads `target`; there is no
      // `affordance` field on DoubleClickEvent.
      const { hit, bodyTarget, bodyKind } = resolveTarget(input.target);
      return { kind: 'doubleclick', ...mods, target: hit, bodyTarget, bodyKind };
    }

    case 'contextMenu': {
      const { hit, bodyTarget, bodyKind } = resolveTarget(input.target);
      return { kind: 'contextmenu', ...mods, target: hit, bodyTarget, bodyKind };
    }

    case 'drag': {
      // A `drag` spec matches the pointerdown dispatch with `stage` unset.
      const { hit, bodyTarget, bodyKind } = resolveTarget(input.target);
      return { kind: 'pointerdown', ...mods, affordance: hit, bodyTarget, bodyKind };
    }

    case 'pointerDown': {
      // The eager, `stage: 'press'` dispatch of the same physical press.
      const { hit, bodyTarget, bodyKind } = resolveTarget(input.target);
      return { kind: 'pointerdown', ...mods, stage: 'press', affordance: hit, bodyTarget, bodyKind };
    }
  }
}

/** Is this spec's target a `{ kindOf }` predicate rather than a named class?
 *  Drives the `?` badge. */
export function isPredicateTarget(spec: unknown): boolean {
  const t = (spec as { target?: unknown } | null | undefined)?.target;
  return typeof t === 'object' && t !== null && 'kindOf' in t;
}
