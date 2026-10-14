import { act, cleanup, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderSettled } from '@weasel-js/react/testing/renderSettled';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { MeasureLabDemo } from '../MeasureLabDemo';

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

const mover = () => window.__weaselTest!.getScene().nodes.find((n) => n.id === 'mover');
const readout = () => screen.getAllByRole('status').map((el) => el.textContent);

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

describe('MeasureLabDemo', () => {
  it('moves the selected square onto the target by the seeded measurement, and undoes it', async () => {
    await renderSettled(<MeasureLabDemo />);
    expect(readout().slice(1, 3)).toEqual(['240.00', '120.00']);

    await userEvent.click(screen.getByRole('button', { name: 'Move by' }));
    expect(mover()?.pose).toMatchObject({ x: 300, y: 180 });

    await userEvent.click(screen.getByRole('button', { name: 'Undo' }));
    expect(mover()?.pose).toMatchObject({ x: 60, y: 60 });
  });

  it('measures a drag on the canvas, snapped to the grid, and moves by that', async () => {
    const { container } = await renderSettled(<MeasureLabDemo />);
    const canvas = container.querySelector('.lk-trial-scene canvas');
    if (!canvas) throw new Error('no scene canvas in the trial');
    drag(canvas, [303, 251], [358, 312]);
    expect(readout().slice(1, 3)).toEqual(['60.00', '60.00']);

    await userEvent.click(screen.getByRole('button', { name: 'Move by' }));
    expect(mover()?.pose).toMatchObject({ x: 120, y: 120 });
  });
});
