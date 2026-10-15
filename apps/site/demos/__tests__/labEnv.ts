/**
 * What a `<Lab>` needs from jsdom that the root setup does not give every
 * project: a ResizeObserver reporting a box, since a windease container renders
 * nothing until it is measured and jsdom measures everything as 0. labkit's
 * own project installs the same stub.
 */
import { act, cleanup } from '@testing-library/react';
import { afterEach, beforeAll } from 'vitest';

/** Install the stub, run with `?test=1` so the canvas publishes
 *  `window.__weaselTest`, and clean both up after each test. */
export function installLabEnv(): void {
  beforeAll(() => {
    window.history.replaceState(null, '', '/?test=1');
    if (typeof globalThis.ResizeObserver !== 'undefined') return;
    globalThis.ResizeObserver = class {
      #cb: ResizeObserverCallback;
      constructor(cb: ResizeObserverCallback) {
        this.#cb = cb;
      }
      observe(target: Element) {
        const contentRect = { width: 1024, height: 768, x: 0, y: 0, top: 0, left: 0 };
        this.#cb([{ target, contentRect } as ResizeObserverEntry], this);
      }
      unobserve() {}
      disconnect() {}
    } as unknown as typeof ResizeObserver;
  });
  afterEach(() => {
    cleanup();
    delete window.__weaselTest;
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
