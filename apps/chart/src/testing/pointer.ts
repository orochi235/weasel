type Point = { x: number; y: number };

export async function frames(n = 1): Promise<void> {
  for (let i = 0; i < n; i++) await new Promise((r) => requestAnimationFrame(r));
}

/** Dispatches a primary mouse pointer event; `buttons` is 0 on a `pointerup` whatever is passed. */
export function pointer(el: Element, type: string, p: Point, buttons = 1): void {
  el.dispatchEvent(new PointerEvent(type, {
    bubbles: true, cancelable: true, pointerId: 1, pointerType: 'mouse', isPrimary: true,
    button: 0, buttons: type === 'pointerup' ? 0 : buttons, clientX: p.x, clientY: p.y,
  }));
}

/** Hovers `from`, presses, moves to `to` in eight steps a frame apart, releases, and waits a frame. */
export async function drag(el: Element, from: Point, to: Point): Promise<void> {
  pointer(el, 'pointermove', from, 0);
  pointer(el, 'pointerdown', from);
  for (let i = 1; i <= 8; i++) {
    pointer(el, 'pointermove', { x: from.x + ((to.x - from.x) * i) / 8, y: from.y + ((to.y - from.y) * i) / 8 });
    await frames();
  }
  pointer(el, 'pointerup', to);
  await frames();
}

function press(el: Element, p: Point, detail: number): void {
  pointer(el, 'pointerdown', p);
  pointer(el, 'pointerup', p);
  el.dispatchEvent(new MouseEvent('click', { bubbles: true, clientX: p.x, clientY: p.y, detail }));
}

/** Hovers `p` for a frame, then clicks it and waits a frame. */
export async function click(el: Element, p: Point): Promise<void> {
  pointer(el, 'pointermove', p, 0);
  await frames();
  press(el, p, 1);
  await frames();
}

export function doubleClick(el: Element, p: Point): void {
  press(el, p, 1);
  press(el, p, 2);
  el.dispatchEvent(new MouseEvent('dblclick', { bubbles: true, clientX: p.x, clientY: p.y, detail: 2 }));
}
