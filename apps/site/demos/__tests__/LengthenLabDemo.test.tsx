import { act, cleanup, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderSettled } from '@weasel-js/react/testing/renderSettled';
import { pathInWorld, pathToAnchors, type PolygonPath } from '@weasel-js/core';
import { StrictMode } from 'react';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { LengthenLabDemo, SEEDED_PATH_ID } from '../LengthenLabDemo';
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

/** The gently curved path's anchors, in world space. */
function gentle() {
  const node = window.__weaselTest!.getScene().nodes.find((n) => n.id === SEEDED_PATH_ID)!;
  const world = pathInWorld((node.data as { path: PolygonPath }).path, node.pose as never) as PolygonPath;
  return pathToAnchors(world).anchors[0];
}

// jsdom's canvas rect is all zeros and the view is identity, so client
// coords are world coords.
function drag(canvas: Element, [x0, y0]: number[], [x1, y1]: number[], shiftKey = false) {
  const at = (type: string, x: number, y: number) =>
    canvas.dispatchEvent(new PointerEvent(type, {
      bubbles: true, clientX: x, clientY: y, pointerId: 1, button: 0, buttons: 1, shiftKey,
    }));
  act(() => {
    at('pointerdown', x0, y0);
    at('pointermove', (x0 + x1) / 2, (y0 + y1) / 2);
    at('pointermove', x1, y1);
    at('pointerup', x1, y1);
  });
}

async function mount() {
  // Under StrictMode, as the site mounts it: the double mount is what once left Select current.
  const { container } = await renderSettled(<StrictMode><LengthenLabDemo /></StrictMode>, { wrapper: withIcons });
  const canvas = container.querySelector('.lk-trial-scene canvas');
  if (!canvas) throw new Error('no scene canvas in the trial');
  return canvas;
}

// The gently curved path ends at (320, 120), heading along (80, -45).
const DIR = { x: 80 / Math.hypot(80, 45), y: -45 / Math.hypot(80, 45) };
const out = (d: number) => [320 + DIR.x * d, 120 + DIR.y * d];

describe('LengthenLabDemo', () => {
  it('opens with Lengthen current in the palette, and again after Reset', async () => {
    const canvas = await mount();
    // The palette marks its current tool the way it marks Select's: compare the two.
    const current = (name: RegExp) => {
      const b = screen.getByRole('button', { name });
      return b.getAttribute('aria-pressed') === 'true' || b.hasAttribute('aria-current');
    };
    expect([current(/^Lengthen$/), current(/^Select/)]).toEqual([true, false]);
    drag(canvas, [320, 120], out(30));
    expect(gentle()).toHaveLength(3);

    await userEvent.click(screen.getByRole('button', { name: /^Reset/ }));
    expect(gentle()).toHaveLength(2);
    expect([current(/^Lengthen$/), current(/^Select/)]).toEqual([true, false]);
    drag(canvas, [320, 120], out(30));
    expect(gentle()).toHaveLength(3);
  });

  it('moves the anchor instead once Anchors is picked in the palette', async () => {
    const canvas = await mount();
    await userEvent.click(screen.getByRole('button', { name: /^Anchors/ }));
    drag(canvas, [320, 120], [320, 160]);
    expect(gentle()).toHaveLength(2);
    expect(gentle()[1]).toMatchObject({ x: 320, y: 160 });
  });

  it('opens on a path in edit with Lengthen on, and a drag on its end lengthens it straight on, undone in one step', async () => {
    const canvas = await mount();
    expect(gentle()).toHaveLength(2);

    drag(canvas, [320, 120], out(40));
    const grown = gentle();
    expect(grown).toHaveLength(3);
    expect(grown[2].x).toBeCloseTo(out(40)[0], 1);
    expect(grown[2].y).toBeCloseTo(out(40)[1], 1);

    await userEvent.click(screen.getByRole('button', { name: 'Undo' }));
    expect(gentle()).toHaveLength(2);
  });

  it('follows the end curvature with Shift held', async () => {
    const canvas = await mount();
    drag(canvas, [320, 120], out(60), true);
    const end = gentle().at(-1)!;
    // The end bends up and to the left of its tangent, toward -y.
    expect(end.inHandle).toBeDefined();
    expect(end.y).toBeLessThan(out(60)[1] - 1);
  });

  it("makes curvature the unmodified mode when the panel says so, and Shift then goes straight", async () => {
    const canvas = await mount();
    await userEvent.click(screen.getByRole('radio', { name: 'Curvature' }));
    drag(canvas, [320, 120], out(60));
    expect(gentle().at(-1)!.y).toBeLessThan(out(60)[1] - 1);
    await userEvent.click(screen.getByRole('button', { name: 'Undo' }));
    drag(canvas, [320, 120], out(60), true);
    expect(gentle().at(-1)!.y).toBeCloseTo(out(60)[1], 1);
  });
});
