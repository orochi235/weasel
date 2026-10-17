import { act, cleanup, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { pathInWorld, pathToAnchors, type PolygonPath, type RectPose } from '@weasel-js/core';
import { renderSettled } from '@weasel-js/react/testing/renderSettled';
import { StrictMode } from 'react';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { SEEDED_SPIRO, SpiroLabDemo } from '../SpiroLabDemo';

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

interface SpiroData { path: PolygonPath; spiro: { kinds: string[]; at: number[] } }
const nodes = () => window.__weaselTest!.getScene().nodes;
const wave = () => nodes().find((n) => n.id === SEEDED_SPIRO)!;

/** The world position of each spiro point of `node`. */
function points(node: { pose: unknown; data: unknown }): number[][] {
  const { path, spiro } = node.data as SpiroData;
  const world = pathInWorld(path, node.pose as RectPose) as PolygonPath;
  const anchors = pathToAnchors(world).anchors.flat();
  return spiro.at.map((i) => [Math.round(anchors[i].x), Math.round(anchors[i].y)]);
}

// jsdom's canvas rect is all zeros and the view is identity, so client
// coords are world coords.
const at = (canvas: Element, type: string, x: number, y: number, init: PointerEventInit = {}) =>
  canvas.dispatchEvent(new PointerEvent(type, { bubbles: true, clientX: x, clientY: y, pointerId: 1, button: 0, buttons: 1, ...init }));

function drag(canvas: Element, [x0, y0]: number[], [x1, y1]: number[]) {
  act(() => {
    at(canvas, 'pointerdown', x0, y0);
    at(canvas, 'pointermove', (x0 + x1) / 2, (y0 + y1) / 2);
    at(canvas, 'pointermove', x1, y1);
    at(canvas, 'pointerup', x1, y1, { buttons: 0 });
  });
}

function click(canvas: Element, x: number, y: number) {
  act(() => {
    at(canvas, 'pointerdown', x, y);
    at(canvas, 'pointerup', x, y, { buttons: 0 });
  });
}

const mount = async () => {
  const { container } = await renderSettled(<StrictMode><SpiroLabDemo /></StrictMode>);
  const canvas = container.querySelector('.lk-trial-scene canvas');
  if (!canvas) throw new Error('no scene canvas in the trial');
  return canvas;
};

describe('SpiroLabDemo', () => {
  it('re-solves the seeded curve through a point dragged in path edit, as one undo step', async () => {
    const canvas = await mount();
    const before = wave().data as SpiroData;
    expect(points(wave())[1]).toEqual([160, 170]);

    drag(canvas, [160, 170], [160, 110]);

    const after = wave().data as SpiroData;
    expect(points(wave())[1]).toEqual([160, 110]);
    expect(after.spiro.kinds).toEqual(before.spiro.kinds);
    expect(Array.from(after.path.coords)).not.toEqual(Array.from(before.path.coords));

    await userEvent.click(screen.getByRole('button', { name: 'Undo' }));
    expect(points(wave())[1]).toEqual([160, 170]);
  });

  it('adds a smooth point where the curve is dragged between two points, and moves it', async () => {
    const canvas = await mount();
    const { path, spiro } = wave().data as SpiroData;
    const curve = pathToAnchors(pathInWorld(path, wave().pose as RectPose) as PolygonPath).anchors[0];
    // Halfway along the first cubic, between the first two points.
    const [a, b] = [curve[0], curve[1]];
    const c1 = a.outHandle!, c2 = b.inHandle!;
    const mid = { x: (a.x + 3 * c1.x + 3 * c2.x + b.x) / 8, y: (a.y + 3 * c1.y + 3 * c2.y + b.y) / 8 };

    drag(canvas, [mid.x, mid.y], [mid.x - 20, mid.y - 30]);

    const after = (wave().data as SpiroData).spiro;
    expect(after.kinds).toEqual(['smooth', ...spiro.kinds]);
    expect(points(wave())[1]).toEqual([Math.round(mid.x - 20), Math.round(mid.y - 30)]);
  });

  it('draws a new spiro curve with the tool, one point per click', async () => {
    const canvas = await mount();
    await userEvent.click(screen.getByRole('button', { name: /^Spiro(?! point)/ }));
    click(canvas, 100, 420);
    click(canvas, 200, 360);
    click(canvas, 300, 430);
    act(() => {
      canvas.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    });
    expect(nodes()).toHaveLength(3);
    const drawn = nodes().at(-1)!;
    expect((drawn.data as SpiroData).spiro.kinds).toEqual(['smooth', 'smooth', 'smooth']);
    expect(points(drawn)).toEqual([[100, 420], [200, 360], [300, 430]]);
  });
});
