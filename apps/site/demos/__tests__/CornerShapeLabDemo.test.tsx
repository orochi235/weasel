import { act, cleanup, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { resolveCorners, type PolygonPath } from '@weasel-js/core';
import { renderSettled } from '@weasel-js/react/testing/renderSettled';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { CornerShapeLabDemo } from '../CornerShapeLabDemo';

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

const tileCorners = () => {
  const node = window.__weaselTest!.getScene().nodes.find((n) => n.id === 'tile')!;
  return (node.data as { path: PolygonPath }).path.corners ?? [];
};

// jsdom's canvas rect is all zeros and the view is identity, so client
// coords are world coords.
function pointer(canvas: Element, type: string, x: number, y: number, shiftKey = false) {
  canvas.dispatchEvent(new PointerEvent(type, { bubbles: true, clientX: x, clientY: y, pointerId: 1, button: 0, buttons: 1, shiftKey }));
}
function drag(canvas: Element, [x0, y0]: number[], [x1, y1]: number[]) {
  act(() => {
    pointer(canvas, 'pointerdown', x0, y0);
    pointer(canvas, 'pointermove', (x0 + x1) / 2, (y0 + y1) / 2);
    pointer(canvas, 'pointermove', x1, y1);
    pointer(canvas, 'pointerup', x1, y1);
  });
}
function click(canvas: Element, x: number, y: number, shiftKey = false) {
  act(() => {
    pointer(canvas, 'pointerdown', x, y, shiftKey);
    pointer(canvas, 'pointerup', x, y, shiftKey);
  });
}

const tilePath = () =>
  (window.__weaselTest!.getScene().nodes.find((n) => n.id === 'tile')!.data as { path: PolygonPath }).path;
const radiusField = () => screen.getByRole('spinbutton', { name: 'Radius' }) as HTMLInputElement;
const styleButton = (name: string) => screen.getByRole('radio', { name });

async function mount() {
  const { container } = await renderSettled(<CornerShapeLabDemo />);
  const canvas = container.querySelector('.lk-trial-scene canvas');
  if (!canvas) throw new Error('no scene canvas in the trial');
  return canvas;
}

describe('CornerShapeLabDemo', () => {
  it('rounds the open path\'s corner by dragging its widget, as one undo step', async () => {
    const canvas = await mount();
    expect(tileCorners()[0]).toBeFalsy();

    // Anchor 0 of the tile is (60, 60); its widget sits 14px in along the
    // diagonal. Dragging 20 further along it cuts 40 along each edge.
    const w = 60 + 14 * Math.SQRT1_2;
    drag(canvas, [w, w], [w + 20, w + 20]);
    expect(tileCorners()[0]?.style).toBe('round');
    expect(tileCorners()[0]?.radius).toBeCloseTo(40, 3);

    await userEvent.click(screen.getByRole('button', { name: 'Undo' }));
    expect(tileCorners()[0]).toBeFalsy();
  });

  it('cycles a selected corner\'s style with K', async () => {
    const canvas = await mount();
    click(canvas, 220, 60);
    act(() => { document.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', code: 'KeyK', bubbles: true })); });
    expect(tileCorners()[1]?.style).toBe('chamfer');
  });

  it('opens on a selected sharp corner, which a style turns into a visible one', async () => {
    await mount();
    expect(radiusField().value).toBe('0');
    expect(styleButton('chamfer')).toHaveAttribute('aria-checked', 'false');
    const before = resolveCorners(tilePath()).coords.length;

    await userEvent.click(styleButton('chamfer'));
    expect(tileCorners()[2]?.style).toBe('chamfer');
    expect(tileCorners()[2]?.radius).toBeGreaterThan(0);
    expect(resolveCorners(tilePath()).coords.length).toBeGreaterThan(before);
    expect(styleButton('chamfer')).toHaveAttribute('aria-checked', 'true');
  });

  it("shows the selected corners' style and radius, mixed where they differ", async () => {
    const canvas = await mount();
    click(canvas, 220, 60);
    expect(styleButton('round')).toHaveAttribute('aria-checked', 'true');
    expect(radiusField().value).toBe('24');

    click(canvas, 160, 200, true);
    expect(styleButton('round')).toHaveAttribute('aria-checked', 'false');
    expect(styleButton('chamfer')).toHaveAttribute('aria-checked', 'false');
    expect(radiusField().value).toBe('');

    await userEvent.click(styleButton('inverted'));
    expect(tileCorners()[1]?.style).toBe('inverted');
    expect(tileCorners()[3]?.style).toBe('inverted');
    expect(styleButton('inverted')).toHaveAttribute('aria-checked', 'true');
  });

  it('disables the controls and says what to do with no corner selected', async () => {
    const canvas = await mount();
    expect(screen.queryByText(/Click a corner anchor/)).toBeNull();
    click(canvas, 140, 130);
    expect(screen.getByText('Click a corner anchor (Shift-click for more) to edit it')).toBeInTheDocument();
    expect(radiusField()).toBeDisabled();
    expect(styleButton('round')).toBeDisabled();
  });
});
