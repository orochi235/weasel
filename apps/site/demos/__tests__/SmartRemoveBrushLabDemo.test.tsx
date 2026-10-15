import { act, cleanup, fireEvent, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { type PolygonPath, pathToAnchors } from '@weasel-js/core';
import { renderSettled } from '@weasel-js/react/testing/renderSettled';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { SEEDED_PATH_ID, SmartRemoveBrushLabDemo } from '../SmartRemoveBrushLabDemo';

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

const flowerAnchors = (): { x: number; y: number }[] => {
  const node = window.__weaselTest!.getScene().nodes.find((n) => n.id === SEEDED_PATH_ID);
  const path = (node?.data as { path: PolygonPath }).path;
  return pathToAnchors(path).anchors.flat();
};

// jsdom's canvas rect is all zeros and the view is identity, so client
// coords are world coords.
function altDrag(canvas: Element, [x0, y0]: number[], [x1, y1]: number[]) {
  const at = (type: string, x: number, y: number) =>
    canvas.dispatchEvent(new PointerEvent(type, {
      bubbles: true, clientX: x, clientY: y, pointerId: 1, button: 0, buttons: 1, altKey: true,
    }));
  act(() => {
    at('pointerdown', x0, y0);
    at('pointermove', (x0 + x1) / 2, (y0 + y1) / 2);
    at('pointermove', x1, y1);
    at('pointerup', x1, y1);
  });
}

describe('SmartRemoveBrushLabDemo', () => {
  it('brushes away the anchors an Alt-drag sweeps, as one undo step', async () => {
    const { container } = await renderSettled(<SmartRemoveBrushLabDemo />);
    const canvas = container.querySelector('.lk-trial-scene canvas');
    if (!canvas) throw new Error('no scene canvas in the trial');
    const before = flowerAnchors();
    expect(before).toHaveLength(36);

    // The flower's first anchor sits at (480, 240), on the positive x axis.
    altDrag(canvas, [470, 240], [490, 240]);

    const after = flowerAnchors();
    expect(after).toHaveLength(35);
    expect(after.some((a) => Math.hypot(a.x - 480, a.y - 240) < 1)).toBe(false);

    await userEvent.click(screen.getByRole('button', { name: 'Undo' }));
    expect(flowerAnchors()).toHaveLength(36);
  });

  it("brushes with the control panel's radius", async () => {
    const { container } = await renderSettled(<SmartRemoveBrushLabDemo />);
    const canvas = container.querySelector('.lk-trial-scene canvas');
    if (!canvas) throw new Error('no scene canvas in the trial');
    act(() => {
      fireEvent.change(screen.getByRole('slider', { name: 'Brush radius' }), { target: { value: '60' } });
    });
    // Anchors near (480, 240) sit about 30px apart and the next pair 60px out:
    // the slider's 60px maximum reaches one on either side.
    altDrag(canvas, [478, 240], [484, 240]);
    expect(flowerAnchors()).toHaveLength(33);
  });
});
