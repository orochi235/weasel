import { act, cleanup, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderSettled } from '@weasel-js/react/testing/renderSettled';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { StrokeWidthLabDemo } from '../StrokeWidthLabDemo';

// windease lays a lab's tiles out only once something measures them, and
// jsdom ships no ResizeObserver.
beforeAll(() => {
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
});
afterEach(() => {
  cleanup();
  delete window.__weaselTest;
});

type StrokeData = { stroke?: { width?: number; vertexWidths?: number[]; nib?: { angle: number; ratio: number } } };
const strokes = () => window.__weaselTest!.getScene().nodes.map((n) => (n.data as StrokeData).stroke);

// jsdom's canvas rect is all zeros and the view is identity, so client
// coords are world coords.
function drag(canvas: Element, [x0, y0]: number[], [x1, y1]: number[]) {
  const at = (type: string, x: number, y: number) =>
    canvas.dispatchEvent(new PointerEvent(type, { bubbles: true, clientX: x, clientY: y, pointerId: 1, button: 0, buttons: 1 }));
  act(() => {
    at('pointerdown', x0, y0);
    at('pointermove', (x0 + x1) / 2, (y0 + y1) / 2);
    at('pointermove', x1, y1);
    at('pointerup', x1, y1);
  });
}

describe('StrokeWidthLabDemo', () => {
  it("drags an anchor's width with the Width tool, as one undo entry", async () => {
    const { container } = await renderSettled(<StrokeWidthLabDemo />);
    const canvas = container.querySelector('.lk-trial-scene canvas');
    if (!canvas) throw new Error('no scene canvas in the trial');
    expect(strokes()).toHaveLength(5);
    expect(strokes()[0]?.vertexWidths).toBeUndefined();

    await userEvent.click(screen.getByRole('button', { name: /^Width/ }));
    // The plain stroke's first anchor is at (60, 60): press on it, pull 15 away.
    drag(canvas, [60, 60], [60, 75]);

    expect(strokes()[0]?.vertexWidths?.[0]).toBeCloseTo(30, 6);

    await userEvent.click(screen.getByRole('button', { name: 'Undo' }));
    expect(strokes()[0]?.vertexWidths).toBeUndefined();
  });

  it('writes the nib from the panel onto the selected handwriting', async () => {
    await renderSettled(<StrokeWidthLabDemo />);
    expect(strokes()[4]?.nib?.ratio).toBeCloseTo(0.15, 6);
    const input = screen.getByRole('spinbutton', { name: /Nib thinnest/ });
    await userEvent.clear(input);
    await userEvent.type(input, '0.5{Enter}');
    expect(strokes()[4]?.nib?.ratio).toBeCloseTo(0.5, 6);
    expect(strokes()[0]?.nib).toBeUndefined();
    await userEvent.click(screen.getByRole('checkbox', { name: 'Nib' }));
    expect(strokes()[4]?.nib).toBeUndefined();
  });
});
