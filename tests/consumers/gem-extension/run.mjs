// Runs the built scenario in Node under jsdom, as an app's own test would: `npm run build && npm run scenario`.
import { JSDOM } from 'jsdom';

const { window } = new JSDOM('<!doctype html><html><body></body></html>', { pretendToBeVisual: true, url: 'http://localhost/' });
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

const { runGemScenario } = await import('./dist/scenario.js');
await runGemScenario((line) => console.log(`[gem] ${line}`));
console.log('[gem] scenario passed');
window.close();
