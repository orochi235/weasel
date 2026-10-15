import { act } from '@testing-library/react';

/** windease lays a lab's tiles out only once something measures them, and
 *  jsdom ships no ResizeObserver. */
export function installResizeObserver(): void {
  if (typeof globalThis.ResizeObserver !== 'undefined') return;
  globalThis.ResizeObserver = class {
    #cb: ResizeObserverCallback;
    constructor(cb: ResizeObserverCallback) {
      this.#cb = cb;
    }
    observe(target: Element) {
      this.#cb([{ target, contentRect: { width: 800, height: 600, x: 0, y: 0, top: 0, left: 0 } } as ResizeObserverEntry], this);
    }
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver;
}

function fire(canvas: Element, type: string, x: number, y: number, altKey = false): void {
  canvas.dispatchEvent(new PointerEvent(type, {
    bubbles: true, clientX: x, clientY: y, pointerId: 1, button: 0, buttons: type === 'pointerup' ? 0 : 1, altKey,
  }));
}

// jsdom's canvas rect is all zeros and the view is identity, so client
// coords are world coords.

/** Press at `from`, drag through the midpoint to `to`, release. */
export function pointerDrag(canvas: Element, [x0, y0]: number[], [x1, y1]: number[]): void {
  act(() => {
    fire(canvas, 'pointerdown', x0, y0);
    fire(canvas, 'pointermove', (x0 + x1) / 2, (y0 + y1) / 2);
    fire(canvas, 'pointermove', x1, y1);
    fire(canvas, 'pointerup', x1, y1);
  });
}

/** Press and release at one point. */
export function pointerClick(canvas: Element, x: number, y: number, altKey = false): void {
  act(() => {
    fire(canvas, 'pointerdown', x, y, altKey);
    fire(canvas, 'pointerup', x, y, altKey);
  });
}
