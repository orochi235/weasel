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

const nodes = () => window.__weaselTest!.getScene().nodes;
const node = (id: string) => nodes().find((n) => n.id === id);
const measurements = () => nodes().filter((n) => n.layer === 'annotations');
const readout = () => screen.getAllByRole('status').map((el) => el.textContent);

// jsdom's canvas rect is all zeros and the view is identity, so client
// coords are world coords.
function pointer(canvas: Element, type: string, x: number, y: number) {
  canvas.dispatchEvent(new PointerEvent(type, { bubbles: true, clientX: x, clientY: y, pointerId: 1, button: 0, buttons: 1 }));
}
function click(canvas: Element, x: number, y: number) {
  act(() => {
    pointer(canvas, 'pointerdown', x, y);
    pointer(canvas, 'pointerup', x, y);
  });
}
function drag(canvas: Element, [x0, y0]: number[], [x1, y1]: number[]) {
  act(() => {
    pointer(canvas, 'pointerdown', x0, y0);
    pointer(canvas, 'pointermove', (x0 + x1) / 2, (y0 + y1) / 2);
    pointer(canvas, 'pointermove', x1, y1);
    pointer(canvas, 'pointerup', x1, y1);
  });
}

async function mount() {
  const { container } = await renderSettled(<MeasureLabDemo />);
  const canvas = container.querySelector('.lk-trial-scene canvas');
  if (!canvas) throw new Error('no scene canvas in the trial');
  return canvas;
}

describe('MeasureLabDemo', () => {
  it('opens with two measurements and nothing selected, so Move by says why it cannot run', async () => {
    await mount();
    expect(measurements()).toHaveLength(2);
    expect(readout().slice(1, 3)).toEqual(['240.00', '120.00']);
    const move = screen.getByRole('button', { name: 'Move by' });
    expect(move.getAttribute('aria-disabled')).toBe('true');
    expect(move.getAttribute('aria-description')).toBe('Selection required');
  });

  it('moves the clicked square by the newest measurement, and undoes it', async () => {
    const canvas = await mount();
    click(canvas, 100, 100);
    await userEvent.click(screen.getByRole('button', { name: 'Move by' }));
    expect(node('mover')?.pose).toMatchObject({ x: 300, y: 180 });
    await userEvent.click(screen.getByRole('button', { name: 'Undo' }));
    expect(node('mover')?.pose).toMatchObject({ x: 60, y: 60 });
  });

  it('turns the square by the measurement clicked to pick it, keeping the square selected', async () => {
    const canvas = await mount();
    click(canvas, 100, 100);
    click(canvas, 483, 275);
    expect(readout()[3]).toBe('30.00°');
    await userEvent.click(screen.getByRole('button', { name: 'Rotate by' }));
    expect((node('mover')?.pose as { rotation?: number }).rotation).toBeCloseTo(-Math.PI / 6, 9);
  });

  it('adds a measurement with the measure tool, which stays when the tool changes', async () => {
    const canvas = await mount();
    await userEvent.click(screen.getByRole('button', { name: /^Measure/ }));
    drag(canvas, [603, 403], [658, 462]);
    expect(measurements()).toHaveLength(3);
    expect(readout().slice(1, 3)).toEqual(['60.00', '60.00']);
    await userEvent.click(screen.getByRole('button', { name: /^Select/ }));
    expect(measurements()).toHaveLength(3);
  });
});
