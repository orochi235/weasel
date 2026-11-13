import { describe, expect, it } from 'vitest';
import { canvasToClient, clientToCanvas, layoutBoxOf } from './clientToCanvas';

/** A 200×100 element laid out at client (10, 20), shown at `scale` by an ancestor transform. */
function shown(scale: number, layout = { width: 200, height: 100 }): HTMLElement {
  const el = document.createElement('div');
  Object.defineProperty(el, 'offsetWidth', { value: Math.round(layout.width) });
  Object.defineProperty(el, 'offsetHeight', { value: Math.round(layout.height) });
  el.getBoundingClientRect = () => ({
    left: 10, top: 20, width: layout.width * scale, height: layout.height * scale,
    right: 10 + layout.width * scale, bottom: 20 + layout.height * scale, x: 10, y: 20, toJSON: () => ({}),
  });
  return el;
}

describe('clientToCanvas under an ancestor transform', () => {
  it("answers in the element's own CSS pixels, not client pixels", () => {
    // A stage at half size: the element's right edge is 100 client px in.
    expect(clientToCanvas(shown(0.5), 110, 70)).toEqual([200, 100]);
  });

  it('round-trips through canvasToClient', () => {
    const el = shown(1.5);
    expect(canvasToClient(el, ...clientToCanvas(el, 70, 50))).toEqual([70, 50]);
  });

  it('measures the layout box, not the transformed one', () => {
    expect(layoutBoxOf(shown(2))).toMatchObject({ width: 200, height: 100, scale: { x: 2, y: 2 } });
  });

  it('keeps a fractional width that offsetWidth rounds', () => {
    expect(layoutBoxOf(shown(1, { width: 200.4, height: 100 })).width).toBe(200.4);
  });

  it('reads an element with no layout size (jsdom) as unscaled', () => {
    const el = document.createElement('div');
    el.getBoundingClientRect = () => ({ left: 5, top: 5, width: 50, height: 50 }) as DOMRect;
    expect(clientToCanvas(el, 30, 30)).toEqual([25, 25]);
  });
});
