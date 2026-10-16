import { act } from '@testing-library/react';
import { pathInWorld, pathToAnchors, type Path, type PenAnchor } from '@weasel-js/core';

/** windease lays a lab's tiles out only once something measures them, and
 *  jsdom ships no ResizeObserver. */
export function stubResizeObserver(): void {
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

export function sceneCanvas(container: HTMLElement): HTMLCanvasElement {
  const canvas = container.querySelector<HTMLCanvasElement>('.lk-trial-scene canvas');
  if (!canvas) throw new Error('no scene canvas in the trial');
  return canvas;
}

// jsdom's canvas rect is all zeros and the view is identity, so client
// coords are world coords.
function pointer(canvas: Element, type: string, x: number, y: number, altKey = false): void {
  canvas.dispatchEvent(new PointerEvent(type, { bubbles: true, clientX: x, clientY: y, pointerId: 1, button: 0, buttons: 1, altKey }));
}

export function drag(canvas: Element, [x0, y0]: number[], [x1, y1]: number[]): void {
  act(() => {
    pointer(canvas, 'pointerdown', x0, y0);
    pointer(canvas, 'pointermove', (x0 + x1) / 2, (y0 + y1) / 2);
    pointer(canvas, 'pointermove', x1, y1);
    pointer(canvas, 'pointerup', x1, y1);
  });
}

/** Press and release at one point. */
export function click(canvas: Element, x: number, y: number, altKey = false): void {
  act(() => {
    pointer(canvas, 'pointerdown', x, y, altKey);
    pointer(canvas, 'pointerup', x, y, altKey);
  });
}

/** The anchors of the lab's one path, in world space. */
export function editedAnchors(): PenAnchor[] {
  const node = window.__weaselTest!.getScene().nodes[0];
  const world = pathInWorld((node.data as { path: Path }).path, node.pose as never);
  return pathToAnchors(world as never).anchors[0];
}

export function doubleClick(canvas: Element, x: number, y: number): void {
  act(() => {
    for (let i = 0; i < 2; i++) {
      pointer(canvas, 'pointerdown', x, y);
      pointer(canvas, 'pointerup', x, y);
    }
  });
}

/** A key pressed and released at the page, as the canvas holding the keys hears it. */
export function press(key: string, code: string, mods: { altKey?: boolean; shiftKey?: boolean } = {}): void {
  act(() => {
    for (const type of ['keydown', 'keyup']) {
      document.body.dispatchEvent(new KeyboardEvent(type, { key, code, ...mods, bubbles: true, cancelable: true }));
    }
  });
}
