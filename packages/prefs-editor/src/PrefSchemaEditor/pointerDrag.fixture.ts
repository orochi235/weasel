import { act } from '@testing-library/react';

export interface Point { x: number; y: number }

/** Modifier keys held through a drag. */
export type DragKeys = Pick<PointerEventInit, 'altKey' | 'metaKey' | 'ctrlKey' | 'shiftKey'>;

/** Where a press takes hold of `el`: 40px in from its left edge, or its middle if it is narrower, and halfway down. */
export function grip(el: Element): Point {
  const r = el.getBoundingClientRect();
  return { x: r.left + Math.min(40, r.width / 2), y: r.top + r.height / 2 };
}

/** A point of `el`, each of `tx` and `ty` the fraction of the way across and down it. */
export function pointIn(el: Element, tx: number, ty = 0.5): Point {
  const r = el.getBoundingClientRect();
  return { x: r.left + r.width * tx, y: r.top + r.height * ty };
}

/** One pointer event as the browser would send it, with nothing waited on. */
export function pointer(type: 'pointerdown' | 'pointermove' | 'pointerup', on: EventTarget, at: Point, keys: DragKeys = {}): void {
  on.dispatchEvent(new PointerEvent(type, { bubbles: true, pointerId: 1, button: 0, buttons: type === 'pointerup' ? 0 : 1, clientX: at.x, clientY: at.y, isPrimary: true, ...keys }));
}

const STEPS = 8;

/**
 * Press `from`, carry the pointer to `to` in steps, rest there, and let go. Each event is sent inside `act`, so
 * everything React does about it (the render, and the effects that mark where a drop would land) is over before
 * the next one, however long that takes, and the drop is carried out by the time this returns.
 */
export function drag(from: HTMLElement, to: Element | Point, { press = grip(from), ...keys }: DragKeys & { press?: Point } = {}): void {
  const end = to instanceof Element ? grip(to) : to;
  act(() => pointer('pointerdown', from, press, keys));
  for (let i = 1; i <= STEPS; i++) {
    const t = i / STEPS;
    act(() => pointer('pointermove', document, { x: press.x + (end.x - press.x) * t, y: press.y + (end.y - press.y) * t }, keys));
  }
  // Held still, so the place it is let go is read from the layout the drag settled into.
  act(() => pointer('pointermove', document, end, keys));
  act(() => pointer('pointerup', document, end, keys));
}
