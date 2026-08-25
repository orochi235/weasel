import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

// vitest 4's jsdom env no longer hoists Storage APIs to globalThis (its
// `KEYS` list omits localStorage/sessionStorage). The real Storage objects
// live on the jsdom instance vitest stashes at `globalThis.jsdom` — pull
// them onto the global so production code can use `localStorage.foo`.
const jsdomWin = (globalThis as { jsdom?: { window: Window } }).jsdom?.window;
if (jsdomWin && typeof globalThis.localStorage === 'undefined') {
  Object.defineProperty(globalThis, 'localStorage', { value: jsdomWin.localStorage });
  Object.defineProperty(globalThis, 'sessionStorage', { value: jsdomWin.sessionStorage });
}

// windease's ContainerHost calls `new ResizeObserver` unguarded, and jsdom
// ships none. The stub must report a non-zero box: a windease container
// renders no children at all until something measures it, and jsdom's own
// geometry is always 0, so every tiled tile would vanish from the DOM.
if (typeof globalThis.ResizeObserver === 'undefined') {
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
}

// jsdom ships no PointerEvent, so `fireEvent.pointerDown` builds a bare Event
// and drops clientX/clientY — a drag handler then reads `undefined` and computes
// NaN deltas, which the DOM rejects as invalid CSS rather than reporting.
// MouseEvent already carries the coordinate fields.
if (typeof globalThis.PointerEvent === 'undefined') {
  class PointerEventPolyfill extends MouseEvent {
    readonly pointerId: number;
    readonly pointerType: string;
    readonly isPrimary: boolean;
    constructor(type: string, init: PointerEventInit = {}) {
      super(type, init);
      this.pointerId = init.pointerId ?? 1;
      this.pointerType = init.pointerType ?? 'mouse';
      this.isPrimary = init.isPrimary ?? true;
    }
  }
  globalThis.PointerEvent = PointerEventPolyfill as unknown as typeof PointerEvent;
}

// jsdom implements neither side of pointer capture.
if (typeof Element.prototype.setPointerCapture === 'undefined') {
  Element.prototype.setPointerCapture = () => {};
  Element.prototype.releasePointerCapture = () => {};
  Element.prototype.hasPointerCapture = () => false;
}

afterEach(() => {
  cleanup();
});
