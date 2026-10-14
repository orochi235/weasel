import { act, cleanup, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderSettled } from '@weasel-js/react/testing/renderSettled';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { SceneLabDemo } from '../SceneLabDemo';

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

const nodes = () => window.__weaselTest!.getScene().nodes;

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

describe('SceneLabDemo', () => {
  it('draws a rectangle with the tool picked in the trial palette, snapped to the grid', async () => {
    const { container } = await renderSettled(<SceneLabDemo />);
    const canvas = container.querySelector('.lk-trial-scene canvas');
    if (!canvas) throw new Error('no scene canvas in the trial');
    expect(nodes()).toHaveLength(3);

    await userEvent.click(screen.getByRole('button', { name: /^Rectangle/ }));
    drag(canvas, [303, 251], [358, 312]);

    expect(nodes()).toHaveLength(4);
    expect(nodes().at(-1)?.pose).toMatchObject({ x: 300, y: 260, width: 60, height: 60 });

    await userEvent.click(screen.getByRole('button', { name: 'Undo' }));
    expect(nodes()).toHaveLength(3);
  });

  it("hands the control panel's snap setting to the tool on the next drag", async () => {
    const { container } = await renderSettled(<SceneLabDemo />);
    const canvas = container.querySelector('.lk-trial-scene canvas');
    if (!canvas) throw new Error('no scene canvas in the trial');
    await userEvent.click(screen.getByRole('checkbox', { name: 'Snap to grid' }));
    await userEvent.click(screen.getByRole('button', { name: /^Rectangle/ }));
    drag(canvas, [303, 251], [358, 312]);
    expect(nodes().at(-1)?.pose).toMatchObject({ x: 303, y: 251, width: 55, height: 61 });
  });
});
