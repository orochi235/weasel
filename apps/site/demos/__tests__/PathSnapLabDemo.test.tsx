import { StrictMode } from 'react';
import { act, cleanup, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderSettled } from '@weasel-js/react/testing/renderSettled';
import { pathInWorld, type Path } from '@weasel-js/core';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { PathSnapLabDemo } from '../PathSnapLabDemo';
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

const nodes = () => window.__weaselTest!.getScene().nodes;
const lastEnd = () => {
  const node = nodes().at(-1)!;
  const c = pathInWorld((node.data as { path: Path }).path, node.pose as never) as { coords: ArrayLike<number> };
  return [c.coords[c.coords.length - 2], c.coords[c.coords.length - 1]];
};

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

async function mount() {
  const { container } = await renderSettled(<StrictMode><PathSnapLabDemo /></StrictMode>, { wrapper: withIcons });
  const canvas = container.querySelector('.lk-trial-scene canvas');
  if (!canvas) throw new Error('no scene canvas in the trial');
  return canvas;
}

describe('PathSnapLabDemo', () => {
  it('locks a drawn line to where the two diagonals cross', async () => {
    const canvas = await mount();
    expect(nodes()).toHaveLength(6);
    drag(canvas, [650, 450], [283, 228]);
    expect(nodes()).toHaveLength(7);
    const [x, y] = lastEnd();
    expect(x).toBeCloseTo(280, 3);
    expect(y).toBeCloseTo(230, 3);
  });

  it("locks to a text box's center and a rectangle's corner", async () => {
    const canvas = await mount();
    drag(canvas, [440, 590], [662, 398]);
    expect(lastEnd().map((v) => Math.round(v * 1000) / 1000)).toEqual([660, 400]);
    drag(canvas, [440, 590], [717, 483]);
    expect(lastEnd().map((v) => Math.round(v * 1000) / 1000)).toEqual([720, 480]);
  });

  it('stops snapping to a kind the control panel turns off', async () => {
    const canvas = await mount();
    await userEvent.click(screen.getByRole('checkbox', { name: 'Intersections' }));
    drag(canvas, [650, 450], [283, 228]);
    const [x, y] = lastEnd();
    expect(Math.hypot(x - 280, y - 230)).toBeGreaterThan(0.5);
    // Still snapped, to the nearest point on a diagonal: the pointer is 0.2 off the rising one.
    const offLine = Math.min(Math.abs(3 * x + 4 * y - 1760), Math.abs(3 * x - 4 * y + 80)) / 5;
    expect(offLine).toBeLessThan(1e-6);
  });
});
