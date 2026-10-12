/**
 * What a host feeds the pointer recognizer, one per pointer event, and the
 * pump events each becomes.
 */
import type {
  BodyKind, BodyTarget, EventModifiers, InputEvent, PointerDownEvent, PointerSampleStylus,
} from '../ui/inputEvent';
import { stylusOf } from '../ui/stylus';
import { pressedOn, type PressFacts } from './pressFacts';

/** One pointer event, already resolved to both spaces. */
export interface PointerSample extends EventModifiers, PointerSampleStylus {
  pointerId: number;
  clientX: number;
  clientY: number;
  /** The same point in world space. */
  x: number;
  y: number;
  /** What the originating event was aimed at. */
  target?: unknown;
}

/** A pointer going down, with what it landed on. */
export interface PressSample extends PointerSample {
  /** `PointerEvent.pointerType`. Only `'touch'` and `'pen'` arm a long-press. */
  pointerType: string;
  affordance?: unknown;
  bodyTarget?: BodyTarget;
  bodyKind?: BodyKind;
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
  };
}

const at = (s: PointerSample) => ({
  pointerId: s.pointerId, x: s.x, y: s.y, clientX: s.clientX, clientY: s.clientY, ...modifiersOf(s),
});

export function pointerDownEvent(s: PressSample): PointerDownEvent {
  return { kind: 'pointerdown', target: s.target, ...at(s), ...stylusOf(s), ...pressedOn(s) };
}

export function pointerMoveEvent(s: PointerSample): InputEvent {
  return { kind: 'pointermove', ...at(s), ...stylusOf(s) };
}

export function pointerUpEvent(s: PointerSample): InputEvent {
  return { kind: 'pointerup', ...at(s) };
}
