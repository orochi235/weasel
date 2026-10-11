import { act, cleanup, render } from '@testing-library/react';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { LayerListDemo } from '../LayerListDemo';

beforeAll(() => {
  const proto = HTMLCanvasElement.prototype as unknown as {
    getContext: (...args: unknown[]) => unknown;
    setPointerCapture: (...args: unknown[]) => void;
    releasePointerCapture: (...args: unknown[]) => void;
  };
  proto.getContext = vi.fn(() => null);
  proto.setPointerCapture = vi.fn();
  proto.releasePointerCapture = vi.fn();
});
afterEach(cleanup);

function setup() {
  const { container } = render(<LayerListDemo />);
  const canvas = container.querySelector('canvas')!;
  canvas.getBoundingClientRect = () => ({
    left: 0, top: 0, x: 0, y: 0, width: 480, height: 320, right: 480, bottom: 320, toJSON: () => ({}),
  }) as DOMRect;
  const click = (x: number, y: number, init: PointerEventInit = {}) => act(() => {
    const at = { bubbles: true, clientX: x, clientY: y, pointerId: 1, ...init };
    canvas.dispatchEvent(new PointerEvent('pointerdown', at));
    canvas.dispatchEvent(new PointerEvent('pointerup', at));
  });
  const selectedRows = () =>
    [...container.querySelectorAll('[aria-selected="true"]')].map((el) => el.textContent);
  return { click, selectedRows };
}

describe('LayerListDemo', () => {
  it('selects in the list what is clicked on the canvas, and adds with shift', () => {
    const t = setup();
    expect(t.selectedRows()).toEqual([]);
    t.click(80, 90);
    expect(t.selectedRows()).toEqual(['#7fb069']);
    t.click(350, 150, { shiftKey: true });
    expect(t.selectedRows().sort()).toEqual(['#7ab8d4', '#7fb069']);
    t.click(460, 300);
    expect(t.selectedRows()).toEqual([]);
  });
});
