import type { PointerButton } from './inputEvent';

/** `PointerEvent.button` as a press names it. 3 and 4, back and forward, are the browser's. */
const BUTTONS: readonly PointerButton[] = ['primary', 'middle', 'secondary'];

/** A pen's eraser end presses as button 5. */
const ERASER = 5;

/**
 * The button a press was made with, or `null` for one the browser keeps.
 * A pen's eraser end presses like its tip, and its barrel button like a
 * mouse's secondary one. An absent `button` (a synthetic event) is primary.
 */
export function pressButtonOf(e: { button?: number; pointerType?: string }): PointerButton | null {
  const button = e.button ?? 0;
  if (button === ERASER && e.pointerType === 'pen') return 'primary';
  return BUTTONS[button] ?? null;
}

/** Whether a press is a primary one: a mouse's main button, a finger, or a pen's tip or eraser. */
export function isPrimaryPress(e: { button?: number; pointerType?: string }): boolean {
  return pressButtonOf(e) === 'primary';
}
