import { act, cleanup, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderSettled } from '@weasel-js/react/testing/renderSettled';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { SymmetryLabDemo } from '../SymmetryLabDemo';

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

type Node = { pose: { x: number; y: number; width: number; height: number }; data: { path: { coords: ArrayLike<number> } } };
const nodes = () => window.__weaselTest!.getScene().nodes as unknown as Node[];

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
  const { container } = await renderSettled(<SymmetryLabDemo />);
  const canvas = container.querySelector('.lk-trial-scene canvas');
  if (!canvas) throw new Error('no scene canvas in the trial');
  return canvas;
}

describe('SymmetryLabDemo', () => {
  it('moves the mirror partner of a kite anchor dragged in path edit', async () => {
    const canvas = await mount();
    drag(canvas, [380, 160], [400, 150]);
    // An edit stores the path in the pose's frame, whose box is the path's own.
    const { data, pose } = nodes()[0];
    const at = (i: number) => [data.path.coords[i] + pose.x, data.path.coords[i + 1] + pose.y];
    // The right anchor ends the first curve; the left one ends the line before the closing curve.
    expect(at(6)).toEqual([400, 150]);
    expect(at(10)).toEqual([200, 150]);
  });

  it('draws a rectangle and its mirror, and undoes both at once', async () => {
    const canvas = await mount();
    await userEvent.click(screen.getByRole('button', { name: /^Rectangle/ }));
    drag(canvas, [100, 400], [160, 440]);
    expect(nodes().slice(1).map((n) => n.pose)).toMatchObject([
      { x: 100, y: 400, width: 60, height: 40 },
      { x: 440, y: 400, width: 60, height: 40 },
    ]);
    await userEvent.click(screen.getByRole('button', { name: 'Undo' }));
    expect(nodes()).toHaveLength(1);
  });

  it('draws a single rectangle once Symmetry is off in the control panel', async () => {
    const canvas = await mount();
    await userEvent.click(screen.getByRole('checkbox', { name: 'Symmetry' }));
    await userEvent.click(screen.getByRole('button', { name: /^Rectangle/ }));
    drag(canvas, [100, 400], [160, 440]);
    expect(nodes()).toHaveLength(2);
  });
});
