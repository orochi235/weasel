import { act, cleanup, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderSettled } from '@weasel-js/react/testing/renderSettled';
import { StrictMode } from 'react';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { StrokeWidthLabDemo } from '../StrokeWidthLabDemo';
import { withIcons } from '../../testIcons';

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

type StrokeData = {
  stroke?: { width?: number; vertexWidths?: (number | { left: number; right: number })[]; nib?: { angle: number; ratio: number } };
};
const strokes = () => window.__weaselTest!.getScene().nodes.map((n) => (n.data as StrokeData).stroke);

// jsdom's canvas rect is all zeros and the view is identity, so client
// coords are world coords.
function drag(canvas: Element, [x0, y0]: number[], [x1, y1]: number[], altKey = false) {
  const at = (type: string, x: number, y: number) =>
    canvas.dispatchEvent(new PointerEvent(type, { bubbles: true, clientX: x, clientY: y, pointerId: 1, button: 0, buttons: 1, altKey }));
  act(() => {
    at('pointerdown', x0, y0);
    at('pointermove', (x0 + x1) / 2, (y0 + y1) / 2);
    at('pointermove', x1, y1);
    at('pointerup', x1, y1);
  });
}

describe('StrokeWidthLabDemo', () => {
  it("drags a stroke's edge with the Girth tool, both sides or with Alt one, as one undo entry each", async () => {
    const { container } = await renderSettled(<StrictMode><StrokeWidthLabDemo /></StrictMode>, { wrapper: withIcons });
    const canvas = container.querySelector('.lk-trial-scene canvas');
    if (!canvas) throw new Error('no scene canvas in the trial');
    expect(strokes()).toHaveLength(5);
    expect(strokes()[0]?.vertexWidths).toBeUndefined();

    await userEvent.click(screen.getByRole('button', { name: /^Girth/ }));
    // The plain stroke, 8 wide, leaves its first anchor at (60, 60) heading
    // along (2, -1): its right edge there is 4 out along (1, 2) / √5. Press on
    // that edge and pull it 6 farther out along the same normal.
    const n = [1 / Math.sqrt(5), 2 / Math.sqrt(5)];
    const edge = (d: number) => [60 + n[0] * d, 60 + n[1] * d];
    drag(canvas, edge(4), edge(10));
    expect(strokes()[0]?.vertexWidths?.[0]).toBeCloseTo(20, 1);

    drag(canvas, edge(10), edge(14), true);
    expect(strokes()[0]?.vertexWidths?.[0]).toEqual({ left: expect.closeTo(10, 1), right: expect.closeTo(14, 1) });

    await userEvent.click(screen.getByRole('button', { name: 'Undo' }));
    expect(strokes()[0]?.vertexWidths?.[0]).toBeCloseTo(20, 1);
    await userEvent.click(screen.getByRole('button', { name: 'Undo' }));
    expect(strokes()[0]?.vertexWidths).toBeUndefined();
  });

  it('writes the nib from the panel onto the selected handwriting', async () => {
    await renderSettled(<StrokeWidthLabDemo />, { wrapper: withIcons });
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
