import { act, cleanup, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderSettled } from '@weasel-js/react/testing/renderSettled';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { RectPathEditLabDemo } from '../RectPathEditLabDemo';

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

type Node = { id: string; pose: { x: number; y: number; width: number; height: number }; data: { path: { kind: string } } };
const first = () => window.__weaselTest!.getScene().nodes.find((n) => n.id === 'rect-1') as unknown as Node;
const readout = () => within(screen.getByLabelText('Stored path'));

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

describe('RectPathEditLabDemo', () => {
  it('opens on a rectangle in path edit, and its first corner drag stores a polygon', async () => {
    const { container } = await renderSettled(<RectPathEditLabDemo />);
    const canvas = container.querySelector('.lk-trial-scene canvas');
    if (!canvas) throw new Error('no scene canvas in the trial');
    expect(first().data.path.kind).toBe('rect');
    expect(readout().getByText('rect-1 (editing)')).toBeTruthy();
    expect(readout().getByText('rect')).toBeTruthy();

    drag(canvas, [60, 60], [30, 40]);

    expect(first().data.path.kind).toBe('polygon');
    expect(first().pose).toMatchObject({ x: 30, y: 40, width: 170, height: 110 });
    expect(readout().getByText('polygon')).toBeTruthy();

    await userEvent.click(screen.getByRole('button', { name: 'Undo' }));
    expect(first().data.path.kind).toBe('rect');
    expect(first().pose).toMatchObject({ x: 60, y: 60, width: 140, height: 90 });
  });

  it('closes path edit with Done without touching the rectangle', async () => {
    await renderSettled(<RectPathEditLabDemo />);
    await userEvent.click(screen.getByRole('button', { name: 'Done' }));
    expect(readout().getByText('rect-1')).toBeTruthy();
    expect(first().data.path.kind).toBe('rect');
    await userEvent.click(screen.getByRole('button', { name: 'Edit path' }));
    expect(readout().getByText('rect-1 (editing)')).toBeTruthy();
  });
});
