import { act } from '@testing-library/react';

/** The middle of what a sweep reaches for `el`: the item marked with `data-sweep-index` around it, else `el`. */
function middleOf(el: Element): { x: number; y: number } {
  const r = (el.closest('[data-sweep-index]') ?? el).getBoundingClientRect();
  return { x: r.left + Math.min(8, r.width / 2), y: r.top + r.height / 2 };
}

/** Fires `type` at whatever the page draws at `at`, as a mouse with its button down. */
function fireAt(type: string, at: { x: number; y: number }, init: PointerEventInit): void {
  const el = document.elementFromPoint(at.x, at.y);
  if (!el) throw new Error(`nothing is drawn at ${at.x}, ${at.y}`);
  act(() => {
    el.dispatchEvent(new PointerEvent(type, {
      bubbles: true, pointerId: 1, pointerType: 'mouse', button: 0, buttons: 1, clientX: at.x, clientY: at.y, ...init,
    }));
  });
}

/** A drag in real layout from the first of `path` through each of the others to the last, released there: a sweep
 *  across those switches. `init` adds to every event, `{ altKey: true }` for an Alt-drag. For browser tests. */
export function sweepAcross(path: readonly Element[], init: PointerEventInit = {}): void {
  const points = path.map(middleOf);
  const [first, ...rest] = points;
  if (!first) return;
  fireAt('pointerdown', first, init);
  for (const p of rest) fireAt('pointermove', p, init);
  fireAt('pointerup', points.at(-1)!, init);
}
