import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { SharedBrushSizeDemo } from '../SharedBrushSizeDemo';

// jsdom's canvas rect is all zeros and the view is identity, so client coords are world coords.
function pointer(canvas: HTMLCanvasElement, type: string, x: number, y: number) {
  canvas.dispatchEvent(new PointerEvent(type, { bubbles: true, clientX: x, clientY: y, pointerId: 1 }));
}
function drag(canvas: HTMLCanvasElement, y: number, x0: number, x1: number) {
  act(() => {
    pointer(canvas, 'pointerdown', x0, y);
    for (let x = x0 + 10; x <= x1; x += 10) pointer(canvas, 'pointermove', x, y);
    pointer(canvas, 'pointerup', x1, y);
  });
}
const nodes = () => [...window.__weaselTest!.getScene().nodes.values()];
const size = () => Number((screen.getByRole('slider') as HTMLInputElement).value);

beforeAll(() => {
  window.history.replaceState(null, '', '/?test=1');
});
afterEach(() => {
  cleanup();
  delete window.__weaselTest;
});

describe('SharedBrushSizeDemo', () => {
  it('stamps a dot per radius of travel, and erases the dots a stroke passes over', () => {
    const { container } = render(<SharedBrushSizeDemo />);
    const canvas = container.querySelector('canvas')!;
    drag(canvas, 100, 40, 200);
    const stamped = nodes().length;
    expect(stamped).toBeGreaterThan(3);
    fireEvent.click(screen.getByRole('button', { name: /erase/i }));
    drag(canvas, 100, 40, 120);
    expect(nodes().length).toBeLessThan(stamped);
    expect(nodes().length).toBeGreaterThan(0);
  });

  it('stamps where crypto.randomUUID is missing, as on a page served over plain http to another machine', () => {
    const real = Object.getOwnPropertyDescriptor(crypto, 'randomUUID');
    Object.defineProperty(crypto, 'randomUUID', { value: undefined, configurable: true });
    try {
      const { container } = render(<SharedBrushSizeDemo />);
      drag(container.querySelector('canvas')!, 100, 40, 200);
      expect(nodes().length).toBeGreaterThan(3);
    } finally {
      if (real) Object.defineProperty(crypto, 'randomUUID', real);
      else delete (crypto as { randomUUID?: unknown }).randomUUID;
    }
  });

  it('keeps a size per brush, and one size for both once shared', () => {
    render(<SharedBrushSizeDemo />);
    const slider = () => screen.getByRole('slider');
    fireEvent.change(slider(), { target: { value: '40' } });
    expect(size()).toBe(40);
    fireEvent.click(screen.getByRole('button', { name: /erase/i }));
    expect(size()).toBe(16);
    fireEvent.click(screen.getByLabelText('Share brush size'));
    fireEvent.change(slider(), { target: { value: '30' } });
    fireEvent.click(screen.getByRole('button', { name: /dots/i }));
    expect(size()).toBe(30);
  });
});
