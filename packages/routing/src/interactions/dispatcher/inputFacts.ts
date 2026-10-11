/** What the dispatcher reads straight off an input event. */
import type { InputEvent } from './matcher';

/**
 * Modifier flags as an immediate invoker sees them, in the kit's
 * `ModifierState` spelling rather than the DOM's `*Key` one.
 *
 * Ongoing invokers read modifiers off `InvocationCtx`; immediate ones get only
 * `(deps, params)`, so pointer-driven immediate actions need them merged into
 * params the same way wheel deltas already are. Most actions should still
 * express modifier semantics as separate bindings with `opts.params` — that is
 * what makes them visible to conflict detection and the inspector. This is for
 * the cases where the modifier is data rather than a route, e.g. select
 * forwarding the press's modifiers into `SelectionApi.applyClick`, which
 * resolves them against the host's configured extend key.
 */
export function modifiersOf(e: {
  altKey: boolean; ctrlKey: boolean; metaKey: boolean; shiftKey: boolean;
}): { alt: boolean; ctrl: boolean; meta: boolean; shift: boolean } {
  return { alt: e.altKey, ctrl: e.ctrlKey, meta: e.metaKey, shift: e.shiftKey };
}

/** The world point an event landed on, for `Action.enabled`'s position
 *  argument. Undefined for events with no position (keys, drops, pastes). */
export function worldPointOf(event: InputEvent): { x: number; y: number } | undefined {
  switch (event.kind) {
    case 'pointerdown':
    case 'longpress':
    case 'click':
    case 'doubleclick':
    case 'contextmenu':
      return event.x !== undefined && event.y !== undefined ? { x: event.x, y: event.y } : undefined;
    default:
      return undefined;
  }
}
