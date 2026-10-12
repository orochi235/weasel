/**
 * What the dispatcher remembers of a press, and the events a hold on it
 * synthesizes.
 */
import type { BodyTarget } from '@weasel-js/gestures';
import type { InputEvent } from './matcher';

/** Press-time state replayed onto a synthesized click, long-press or
 *  contextmenu, whose matchers resolve targets against it. */
export interface PressFacts {
  target: unknown;
  clientX: number;
  clientY: number;
  /** World-space press point, forwarded onto the synthesized click as
   *  `pressX`/`pressY` — see `ClickEvent`. */
  worldX: number;
  worldY: number;
  affordance?: unknown;
  bodyTarget?: BodyTarget;
  bodyKind?: string;
  altKey: boolean;
  ctrlKey: boolean;
  metaKey: boolean;
  shiftKey: boolean;
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
    ...(down.affordance !== undefined ? { affordance: down.affordance } : {}),
    ...(down.bodyTarget !== undefined ? { bodyTarget: down.bodyTarget } : {}),
    ...(down.bodyKind !== undefined ? { bodyKind: down.bodyKind } : {}),
  };
  const at = { x: down.worldX, y: down.worldY, clientX: down.clientX, clientY: down.clientY };
  return {
    longpress: { kind: 'longpress', ...at, ...shared } as InputEvent,
    contextmenu: { kind: 'contextmenu', ...at, ...shared } as InputEvent,
  };
}
