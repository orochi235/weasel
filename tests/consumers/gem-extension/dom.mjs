// A browser's globals in Node, from jsdom: what an app's own tests under jsdom run with.
import { JSDOM } from 'jsdom';

export const { window } = new JSDOM('<!doctype html><html><body></body></html>', { pretendToBeVisual: true, url: 'http://localhost/' });
for (const key of Object.getOwnPropertyNames(window)) {
  if (!(key in globalThis)) Object.defineProperty(globalThis, key, { configurable: true, writable: true, value: window[key] });
}
for (const key of ['window', 'document', 'navigator', 'Event', 'EventTarget', 'CustomEvent']) {
  Object.defineProperty(globalThis, key, { configurable: true, writable: true, value: key === 'window' ? window : window[key] });
}
// jsdom draws nothing and captures no pointer: a canvas gets no context, which the kit takes as "nothing to paint on".
window.HTMLCanvasElement.prototype.getContext = () => null;
window.Element.prototype.setPointerCapture ??= () => {};
window.Element.prototype.releasePointerCapture ??= () => {};
window.Element.prototype.hasPointerCapture ??= () => false;
