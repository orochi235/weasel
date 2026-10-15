import { act } from '@testing-library/react';
import { pathInWorld, pathToAnchors, type Path, type PenAnchor, type PolygonPath } from '@weasel-js/core';
import { LAB_PATH_ID } from '../pathEditLabScene';

/** windease lays a lab's tiles out only once something measures them, and
 *  jsdom ships no ResizeObserver. */
export function installLabEnvironment(): void {
  window.history.replaceState(null, '', '/?test=1');
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

/** The lab path's anchors in world space. */
export function labAnchors(): PenAnchor[] {
  const node = window.__weaselTest!.getScene().nodes.find((n) => n.id === LAB_PATH_ID)!;
  const world = pathInWorld((node.data as { path: Path }).path, node.pose as never) as PolygonPath;
  return pathToAnchors(world).anchors[0]!;
}

/** A pointer drag in client coords, which in jsdom are world coords: the
 *  canvas rect is all zeros and the view is identity. */
export function drag(canvas: Element, [x0, y0]: number[], [x1, y1]: number[]): void {
  const at = (type: string, x: number, y: number) =>
    canvas.dispatchEvent(new PointerEvent(type, { bubbles: true, clientX: x, clientY: y, pointerId: 1, button: 0, buttons: 1 }));
  act(() => {
    at('pointerdown', x0, y0);
    at('pointermove', (x0 + x1) / 2, (y0 + y1) / 2);
    at('pointermove', x1, y1);
    at('pointerup', x1, y1);
  });
}

/** The trial's scene canvas. */
export function sceneCanvas(container: Element): Element {
  const canvas = container.querySelector('.lk-trial-scene canvas');
  if (!canvas) throw new Error('no scene canvas in the trial');
  return canvas;
}
