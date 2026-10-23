/** What the dispatcher reads straight off an input event. */
import type { Carried } from '../actions/action';
import type { ModifierState } from '../../vocabulary';
import type { InputEvent } from './matcher';

/**
 * Modifier flags as an immediate invoker sees them, in the kit's
 * `ModifierState` spelling rather than the DOM's `*Key` one.
 *
 * Most actions should still express modifier semantics as separate bindings
 * with `opts.params` — that is what makes them visible to conflict detection
 * and the inspector. This is for the cases where the modifier is data rather
 * than a route.
 */
export function modifierStateOf(e: {
  altKey: boolean; ctrlKey: boolean; metaKey: boolean; shiftKey: boolean;
}): ModifierState {
  return { alt: e.altKey, ctrl: e.ctrlKey, meta: e.metaKey, shift: e.shiftKey };
}

/** The world point an event landed on, for `Action.enabled`'s position
 *  argument. Undefined for events with no position (keys, drops, pastes). */
export function worldPointOf(event: InputEvent): { x: number; y: number } | undefined {
  switch (event.kind) {
    case 'pointerdown':
    case 'hover':
    case 'longpress':
    case 'click':
    case 'doubleclick':
    case 'contextmenu':
      return event.x !== undefined && event.y !== undefined ? { x: event.x, y: event.y } : undefined;
    case 'carry':
      return { x: event.x, y: event.y };
    default:
      return undefined;
  }
}

/** What a drop, a paste or a carry brings, for `Action.enabled`'s `carried`
 *  argument. Undefined for every other event. */
export function carriedBy(event: InputEvent): Carried | undefined {
  if (event.kind === 'carry') return { items: [], carry: { type: event.type, value: event.value } };
  return event.kind === 'drop' || event.kind === 'paste' ? { items: event.items } : undefined;
}

/**
 * The params an immediate invoker runs with: what the event carries, under the
 * binding's own `resolved` params. An immediate invoker gets `(deps, params)`
 * and no `InvocationCtx`, so this is where it reads deltas and positions.
 */
export function immediateParams(
  event: InputEvent,
  resolved: Record<string, unknown> | undefined,
): Record<string, unknown> | undefined {
  switch (event.kind) {
    case 'wheel':
      return {
        deltaX: event.deltaX, deltaY: event.deltaY,
        clientX: event.clientX, clientY: event.clientY,
        affordance: event.affordance,
        ...resolved,
      };
    case 'pinch':
      return {
        scale: event.scale, rotation: event.rotation,
        clientX: event.clientX, clientY: event.clientY,
        affordance: event.affordance,
        ...resolved,
      };
    case 'click':
    case 'doubleclick':
      return {
        worldX: event.x, worldY: event.y,
        affordance: event.affordance,
        // The press point too: an action that places geometry at the click wants it.
        ...(event.kind === 'click' ? { pressX: event.pressX, pressY: event.pressY } : {}),
        mods: modifierStateOf(event),
        ...resolved,
      };
    // Only a `stage: 'press'` pointerdown reaches an immediate invoker: the
    // buffered copy matches `drag` specs, which are ongoing.
    case 'contextmenu':
      return {
        worldX: event.x, worldY: event.y,
        clientX: event.clientX, clientY: event.clientY,
        affordance: event.affordance,
        bodyTarget: event.bodyTarget,
        bodyKind: event.bodyKind,
        mods: modifierStateOf(event),
        ...resolved,
      };
    case 'pointerdown':
    case 'longpress':
      return {
        worldX: event.x, worldY: event.y,
        affordance: event.affordance,
        bodyTarget: event.bodyTarget,
        mods: modifierStateOf(event),
        ...resolved,
      };
    case 'hover':
      return {
        worldX: event.x, worldY: event.y,
        clientX: event.clientX, clientY: event.clientY,
        affordance: event.affordance,
        bodyTarget: event.bodyTarget,
        mods: modifierStateOf(event),
        held: event.held === true,
        ...resolved,
      };
    case 'carry':
      return {
        worldX: event.x, worldY: event.y,
        clientX: event.clientX, clientY: event.clientY,
        carry: { type: event.type, value: event.value },
        affordance: event.affordance,
        bodyTarget: event.bodyTarget,
        bodyKind: event.bodyKind,
        mods: modifierStateOf(event),
        ...resolved,
      };
    case 'drop':
    case 'paste':
      return {
        items: event.items,
        via: event.kind,
        ...(event.kind === 'drop' && event.x !== undefined ? { worldX: event.x, worldY: event.y } : {}),
        ...resolved,
      };
    default:
      return resolved;
  }
}
