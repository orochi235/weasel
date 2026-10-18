/**
 * What a host feeds the pointer recognizer, one per pointer event, and the
 * pump events each becomes.
 */
import type {
  BodyKind, BodyTarget, DoubleClickBody, EventModifiers, InputEvent, PointerDownEvent, PointerSampleStylus,
} from '../ui/inputEvent';
import { stylusOf } from '../ui/stylus';
import type { Point } from './multiTouch';
import { pressedOn, type PressFacts } from './pressFacts';

/** One pointer event, in client space. */
export interface PointerSample extends EventModifiers, PointerSampleStylus {
  pointerId: number;
  clientX: number;
  clientY: number;
  /** What the originating event was aimed at. */
  target?: unknown;
}

/** A pointer going down, with what the host found under it. */
export interface PressSample extends PointerSample {
  /** The world point the host hit-tested at. */
  x: number;
  y: number;
  /** `PointerEvent.pointerType`. Only `'touch'` and `'pen'` arm a long-press. */
  pointerType: string;
  affordance?: unknown;
  bodyTarget?: BodyTarget;
  bodyKind?: BodyKind;
  /** What a double click this press completes lands on, where not the body hit. */
  doubleClickBody?: DoubleClickBody;
}

export function modifiersOf(e: EventModifiers): EventModifiers {
  return { altKey: e.altKey, ctrlKey: e.ctrlKey, metaKey: e.metaKey, shiftKey: e.shiftKey };
}

export function pressFactsOf(s: PressSample): PressFacts {
  return {
    target: s.target,
    clientX: s.clientX,
    clientY: s.clientY,
    worldX: s.x,
    worldY: s.y,
    ...modifiersOf(s),
    ...pressedOn(s),
    ...(s.doubleClickBody !== undefined ? { doubleClickBody: s.doubleClickBody } : {}),
  };
}

const at = (s: PointerSample, world: Point) => ({
  pointerId: s.pointerId, x: world.x, y: world.y, clientX: s.clientX, clientY: s.clientY, ...modifiersOf(s),
});

export function pointerDownEvent(s: PressSample): PointerDownEvent {
  return { kind: 'pointerdown', target: s.target, ...at(s, s), ...stylusOf(s), ...pressedOn(s) };
}

export function pointerMoveEvent(s: PointerSample, world: Point): InputEvent {
  return { kind: 'pointermove', ...at(s, world), ...stylusOf(s) };
}

export function pointerUpEvent(s: PointerSample, world: Point): InputEvent {
  return { kind: 'pointerup', ...at(s, world) };
}
