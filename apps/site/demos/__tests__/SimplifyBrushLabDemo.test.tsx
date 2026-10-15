import { act, cleanup, fireEvent, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { type PolygonPath, pathToAnchors } from '@weasel-js/core';
import { renderSettled } from '@weasel-js/react/testing/renderSettled';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { SEEDED_PATH_ID, SimplifyBrushLabDemo } from '../SimplifyBrushLabDemo';

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

const scribble = (): { x: number; y: number }[] => {
  const node = window.__weaselTest!.getScene().nodes.find((n) => n.id === SEEDED_PATH_ID);
  const path = (node?.data as { path: PolygonPath }).path;
  return pathToAnchors(path).anchors.flat();
};

// jsdom's canvas rect is all zeros and the view is identity, so client
// coords are world coords.
function dragThrough(canvas: Element, points: readonly { x: number; y: number }[]) {
  const at = (type: string, p: { x: number; y: number }) =>
    canvas.dispatchEvent(new PointerEvent(type, {
      bubbles: true, clientX: p.x, clientY: p.y, pointerId: 1, button: 0, buttons: 1,
    }));
  act(() => {
    at('pointerdown', points[0]);
    for (const p of points.slice(1)) at('pointermove', p);
    at('pointerup', points[points.length - 1]);
  });
}

/** A stroke along the scribble itself, from its 40th anchor to its 160th. */
const alongScribble = () => scribble().slice(40, 161).filter((_, i) => i % 4 === 0);

async function mount() {
  const { container } = await renderSettled(<SimplifyBrushLabDemo />);
  const canvas = container.querySelector('.lk-trial-scene canvas');
  if (!canvas) throw new Error('no scene canvas in the trial');
  return canvas;
}

describe('SimplifyBrushLabDemo', () => {
  it('opens with the brush on: a plain drag thins the stretch it covers, as one undo step', async () => {
    const canvas = await mount();
    const before = scribble().length;
    dragThrough(canvas, alongScribble());
    expect(scribble().length).toBeLessThan(before - 60);

    await userEvent.click(screen.getByRole('button', { name: 'Undo' }));
    expect(scribble()).toHaveLength(before);
  });

  it("refits at the control panel's tolerance", async () => {
    const canvas = await mount();
    dragThrough(canvas, alongScribble());
    const atDefault = scribble().length;
    cleanup();

    const again = await mount();
    act(() => {
      fireEvent.change(screen.getByRole('slider', { name: 'Tolerance' }), { target: { value: '20' } });
    });
    dragThrough(again, alongScribble());
    expect(scribble().length).toBeLessThan(atDefault);
  });

  it('edits anchors as usual once Select is picked in the palette', async () => {
    const canvas = await mount();
    const before = scribble().length;
    await userEvent.click(screen.getByRole('button', { name: /^Select/ }));
    dragThrough(canvas, alongScribble());
    expect(scribble()).toHaveLength(before);
  });
});
