/**
 * A canvas inside an ancestor transform — a stage zoomed to fit, a scaled
 * preview — is shown on screen at another size than layout gave it. Client
 * coordinates are the screen's; the canvas's view and its buffer are in its
 * own CSS pixels. jsdom lays nothing out, so each element reports the box a
 * browser would: `offsetWidth` its layout size, the client rect its size times
 * the ancestor's scale.
 */
import { renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { useClientToWorld } from 'canvas/useClientToWorld';
import { regionOnCanvas } from 'canvas/readback';
import { sceneNodeClientRect } from './sceneNodeClientRect';
import { useElementSize } from './useCanvasSize';
import { clientToWorld } from './clientToWorld';
import { layoutBoxOf } from '@weasel-js/routing';

/** An 800×600 element laid out at client (40, 30), shown at `scale`. */
function shownAt<T extends HTMLElement>(el: T, scale: number): T {
  Object.defineProperty(el, 'offsetWidth', { value: 800, configurable: true });
  Object.defineProperty(el, 'offsetHeight', { value: 600, configurable: true });
  el.getBoundingClientRect = () => ({
    left: 40, top: 30, width: 800 * scale, height: 600 * scale,
    right: 40 + 800 * scale, bottom: 30 + 600 * scale, x: 40, y: 30, toJSON: () => ({}),
  });
  return el;
}

const VIEW = { x: 0, y: 0, scale: { x: 2, y: 2 } };

describe('a canvas under an ancestor scale of 0.5', () => {
  it("measures its layout size, which its view and buffer are sized in", () => {
    const ref = { current: shownAt(document.createElement('div'), 0.5) };
    const { result } = renderHook(() => useElementSize(ref));
    expect(result.current).toEqual({ width: 800, height: 600 });
  });

  it('maps a client point to the world point drawn under it', () => {
    const ref = { current: shownAt(document.createElement('canvas'), 0.5) };
    const { result } = renderHook(() => useClientToWorld(ref, undefined, { current: VIEW }));
    // 100 client px right of the canvas is 200 of its CSS px, world 100 at scale 2.
    expect(result.current(140, 130)).toEqual([100, 100]);
  });

  it('places a node where the canvas draws it on screen', () => {
    const canvas = shownAt(document.createElement('canvas'), 0.5);
    const rect = sceneNodeClientRect({
      id: 'n', canvas, view: VIEW, getWorldBounds: () => ({ x: 100, y: 100, width: 50, height: 25 }),
    });
    expect(rect).toEqual({ x: 140, y: 130, width: 50, height: 25 });
  });

  it('reads back the buffer pixels under a CSS-pixel region', () => {
    const canvas = shownAt(document.createElement('canvas'), 0.5);
    canvas.width = 1600;
    canvas.height = 1200;
    // A 2x buffer: CSS region (10, 10) is buffer (20, 20), and CSS (5, 5) inside it buffer (30, 30).
    const r = regionOnCanvas(canvas, { x: 10, y: 10, width: 20, height: 20 }, { x: 5, y: 5 }, (d) => 2 * d, (d) => 2 * d);
    expect(r).toEqual({ x: 28, y: 28, width: 4, height: 4 });
  });

  it("takes the scale from a layout box handed to clientToWorld", () => {
    const el = shownAt(document.createElement('div'), 2);
    expect(clientToWorld(440, 330, layoutBoxOf(el), VIEW)).toEqual([100, 75]);
  });
});
