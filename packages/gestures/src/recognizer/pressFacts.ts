/**
 * What the recognizer remembers of a press, and the events a release or a
 * hold on it synthesizes.
 */
import type { BodyKind, BodyTarget, DoubleClickBody, EventModifiers, InputEvent } from '../ui/inputEvent';

/** Press-time state replayed onto a synthesized click, long-press or
 *  contextmenu, whose matchers resolve targets against it. */
export interface PressFacts extends EventModifiers {
  target: unknown;
  clientX: number;
  clientY: number;
  /** World-space press point, forwarded onto the synthesized click as
   *  `pressX`/`pressY` — see `ClickEvent`. */
  worldX: number;
  worldY: number;
  affordance?: unknown;
  bodyTarget?: BodyTarget;
  bodyKind?: BodyKind;
  /** Replayed onto the double click in place of `bodyTarget` and `bodyKind`. */
  doubleClickBody?: DoubleClickBody;
}

/** Where and how a press was released, for the click it turned out to be. */
export interface ReleaseFacts extends EventModifiers {
  target: unknown;
  clientX: number;
  clientY: number;
  worldX: number;
  worldY: number;
}

/** What a press landed on, as a spread-able partial with no `undefined`-valued keys. */
export function pressedOn(
  down: Pick<PressFacts, 'affordance' | 'bodyTarget' | 'bodyKind'>,
): Pick<PressFacts, 'affordance' | 'bodyTarget' | 'bodyKind'> {
  return {
    ...(down.affordance !== undefined ? { affordance: down.affordance } : {}),
    ...(down.bodyTarget !== undefined ? { bodyTarget: down.bodyTarget } : {}),
    ...(down.bodyKind !== undefined ? { bodyKind: down.bodyKind } : {}),
  };
}

/** A press released where it went down, as a click, and as the double click
 *  it is when it follows another closely. Both happen at the release, with the
 *  release's modifiers, on what the press landed on. */
export function clickEvents(down: PressFacts, up: ReleaseFacts): { click: InputEvent; doubleclick: InputEvent } {
  const shared = {
    target: up.target,
    altKey: up.altKey,
    ctrlKey: up.ctrlKey,
    metaKey: up.metaKey,
    shiftKey: up.shiftKey,
    x: up.worldX,
    y: up.worldY,
    clientX: up.clientX,
    clientY: up.clientY,
  };
  const named = down.doubleClickBody;
  return {
    click: { kind: 'click', ...shared, ...pressedOn(down), pressX: down.worldX, pressY: down.worldY },
    doubleclick: {
      kind: 'doubleclick', ...shared,
      ...pressedOn(named ? { affordance: down.affordance, ...named } : down),
    },
  };
}

/** A held press as a long-press, and as the contextmenu it falls back to when
 *  the long-press matches nothing. The fallback is what makes existing
 *  `contextMenu` bindings reachable by touch with no consumer change. */
export function longPressEvents(down: PressFacts): { longpress: InputEvent; contextmenu: InputEvent } {
  const shared = {
    target: down.target,
    altKey: down.altKey,
    ctrlKey: down.ctrlKey,
    metaKey: down.metaKey,
    shiftKey: down.shiftKey,
    ...pressedOn(down),
  };
  const at = { x: down.worldX, y: down.worldY, clientX: down.clientX, clientY: down.clientY };
  return {
    longpress: { kind: 'longpress', ...at, ...shared },
    contextmenu: { kind: 'contextmenu', ...at, ...shared },
  };
}
