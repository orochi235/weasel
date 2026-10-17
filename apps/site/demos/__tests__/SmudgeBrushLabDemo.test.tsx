import { act, cleanup, fireEvent, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderSettled } from '@weasel-js/react/testing/renderSettled';
import { pathToAnchors, type PolygonPath } from '@weasel-js/core';
import { StrictMode } from 'react';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { SmudgeBrushLabDemo } from '../SmudgeBrushLabDemo';
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

const square = () => window.__weaselTest!.getScene().nodes.find((n) => n.id === 'square')!;

// jsdom's canvas rect is all zeros and the view is identity, so client
// coords are world coords.
function drag(canvas: Element, points: number[][]) {
  const at = (type: string, [x, y]: number[]) =>
    canvas.dispatchEvent(new PointerEvent(type, { bubbles: true, clientX: x, clientY: y, pointerId: 1, button: 0, buttons: 1 }));
  act(() => {
    at('pointerdown', points[0]);
    for (const p of points.slice(1)) at('pointermove', p);
    at('pointerup', points[points.length - 1]);
  });
}

describe('SmudgeBrushLabDemo', () => {
  it('smudges the top edge of the selected square up in one undo step', async () => {
    const { container } = await renderSettled(<StrictMode><SmudgeBrushLabDemo /></StrictMode>, { wrapper: withIcons });
    const canvas = container.querySelector('.lk-trial-scene canvas');
    if (!canvas) throw new Error('no scene canvas in the trial');
    expect(square().pose).toMatchObject({ y: 80 });

    drag(canvas, [[170, 85], [170, 75], [170, 65], [170, 55]]);

    const pose = square().pose as { y: number };
    expect(pose.y).toBeLessThan(70);
    expect(pathToAnchors((square().data as { path: PolygonPath }).path).anchors[0].length).toBeGreaterThan(4);

    await userEvent.click(screen.getByRole('button', { name: 'Undo' }));
    expect(square().pose).toMatchObject({ y: 80 });
    expect(pathToAnchors((square().data as { path: PolygonPath }).path).anchors[0]).toHaveLength(4);
  });

  it("smudges with the control panel's radius", async () => {
    const { container } = await renderSettled(<StrictMode><SmudgeBrushLabDemo /></StrictMode>, { wrapper: withIcons });
    const canvas = container.querySelector('.lk-trial-scene canvas');
    if (!canvas) throw new Error('no scene canvas in the trial');
    act(() => {
      fireEvent.change(screen.getByRole('slider', { name: 'Brush radius' }), { target: { value: '5' } });
    });
    // A stroke that stays 6px or more below the edge: a 5px brush never reaches it,
    // where the default 40px one would.
    drag(canvas, [[170, 96], [170, 91], [170, 86]]);
    expect(square().pose).toMatchObject({ y: 80 });
  });
});
