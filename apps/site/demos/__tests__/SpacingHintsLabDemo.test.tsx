import { act, cleanup, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderSettled } from '@weasel-js/react/testing/renderSettled';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { SpacingHintsLabDemo, STRAY_ID } from '../SpacingHintsLabDemo';
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

const stray = () => window.__weaselTest!.getScene().nodes.find((n) => n.id === STRAY_ID)!;

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
  const { container } = await renderSettled(<SpacingHintsLabDemo />, { wrapper: withIcons });
  const canvas = container.querySelector('.lk-trial-scene canvas');
  if (!canvas) throw new Error('no scene canvas in the trial');
  return canvas;
}

describe('SpacingHintsLabDemo', () => {
  it('snaps the stray box into the row at the spacing its siblings keep, and undoes it', async () => {
    const canvas = await mount();
    // Dropped 42 right of the blue box, level with the row: the row's gaps are 40.
    drag(canvas, [300, 300], [462, 120]);
    expect(stray().pose).toMatchObject({ x: 420, y: 80 });

    await userEvent.click(screen.getByRole('button', { name: 'Undo' }));
    expect(stray().pose).toMatchObject({ x: 260, y: 260 });
  });

  it('drops the box where it was let go once the equal-spacing snap is off', async () => {
    const canvas = await mount();
    await userEvent.click(screen.getByRole('checkbox', { name: 'Equal-spacing snap' }));
    drag(canvas, [300, 300], [462, 120]);
    expect(stray().pose).toMatchObject({ x: 422, y: 80 });
  });
});
