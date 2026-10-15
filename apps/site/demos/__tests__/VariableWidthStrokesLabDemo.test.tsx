import { act, cleanup, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderSettled } from '@weasel-js/react/testing/renderSettled';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { VariableWidthStrokesLabDemo } from '../VariableWidthStrokesLabDemo';

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

type StrokeData = { stroke?: { width?: number; widthProfile?: { t: number; width: number }[] } };
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

describe('VariableWidthStrokesLabDemo', () => {
  it('drags a stroke wider with the Width tool, as one undo entry', async () => {
    const { container } = await renderSettled(<VariableWidthStrokesLabDemo />);
    const canvas = container.querySelector('.lk-trial-scene canvas');
    if (!canvas) throw new Error('no scene canvas in the trial');
    expect(strokes()).toHaveLength(4);
    expect(strokes()[0]?.widthProfile).toBeUndefined();

    await userEvent.click(screen.getByRole('button', { name: /^Width/ }));
    // The plain stroke starts at (60, 80): press on it, pull 20 away.
    drag(canvas, [60, 80], [60, 100]);

    const profile = strokes()[0]?.widthProfile;
    expect(profile?.length).toBe(2);
    expect(Math.max(...profile!.map((s) => s.width))).toBeCloseTo(4, 1);

    await userEvent.click(screen.getByRole('button', { name: 'Undo' }));
    expect(strokes()[0]?.widthProfile).toBeUndefined();
  });

  it('writes the base width onto every stroke from the panel', async () => {
    await renderSettled(<VariableWidthStrokesLabDemo />);
    const input = screen.getByRole('spinbutton', { name: /Base width/ });
    await userEvent.clear(input);
    await userEvent.type(input, '20{Enter}');
    expect(strokes().map((s) => s?.width)).toEqual([20, 20, 20, 20]);
  });
});
