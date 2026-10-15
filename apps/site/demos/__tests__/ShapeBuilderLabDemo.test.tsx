import { act, cleanup, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderSettled } from '@weasel-js/react/testing/renderSettled';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { ShapeBuilderLabDemo } from '../ShapeBuilderLabDemo';

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

const ids = () => window.__weaselTest!.getScene().nodes.map((n) => n.id).sort();
const SEED = ['bottom', 'left', 'right'];

// jsdom's canvas rect is all zeros and the view is identity, so client
// coords are world coords.
function drag(canvas: Element, run: [number, number][], altKey = false) {
  const at = (type: string, [x, y]: [number, number]) =>
    canvas.dispatchEvent(new PointerEvent(type, { bubbles: true, clientX: x, clientY: y, pointerId: 1, button: 0, buttons: 1, altKey }));
  act(() => {
    at('pointerdown', run[0]!);
    for (const p of run.slice(1)) at('pointermove', p);
    at('pointerup', run.at(-1)!);
  });
}

async function mount() {
  const { container } = await renderSettled(<ShapeBuilderLabDemo />);
  const canvas = container.querySelector('.lk-trial-scene canvas');
  if (!canvas) throw new Error('no scene canvas in the trial');
  expect(ids()).toEqual(SEED);
  return canvas;
}

describe('ShapeBuilderLabDemo', () => {
  it('opens with the circles selected and the builder in hand, so a drag rebuilds them', async () => {
    const canvas = await mount();
    // From the left circle's own face, through the left-right lens, into the right's own face.
    drag(canvas, [[140, 150], [250, 120], [360, 150]]);
    const after = ids();
    expect(after.some((id) => SEED.includes(id))).toBe(false);
    expect(after.length).toBeGreaterThan(1);

    await userEvent.click(screen.getByRole('button', { name: 'Undo' }));
    expect(ids()).toEqual(SEED);
  });

  it("hands the control panel's plain-drag mode to the tool", async () => {
    const canvas = await mount();
    // Across the left circle's own face and into the left-right lens: two of the seven faces.
    const run: [number, number][] = [[140, 150], [250, 120]];
    drag(canvas, run);
    expect(ids()).toHaveLength(6);
    await userEvent.click(screen.getByRole('button', { name: 'Undo' }));
    await userEvent.click(screen.getByRole('radio', { name: 'Delete' }));
    drag(canvas, run);
    expect(ids()).toHaveLength(5);
  });

  it('brings the circles back, selected, on Reset', async () => {
    const canvas = await mount();
    drag(canvas, [[250, 200], [250, 205]], true);
    expect(ids()).not.toEqual(SEED);
    await userEvent.click(screen.getByRole('button', { name: /^Reset/ }));
    expect(ids()).toEqual(SEED);
    drag(canvas, [[140, 150], [360, 150]]);
    expect(ids()).not.toEqual(SEED);
  });
});
