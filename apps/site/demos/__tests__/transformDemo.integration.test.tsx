import { act, cleanup, render } from '@testing-library/react';
import { afterEach, beforeAll, describe, it, expect, vi } from 'vitest';
import { TransformDemo } from '../TransformDemo';

beforeAll(() => {
  window.history.replaceState(null, '', '/?test=1');
  const proto = HTMLCanvasElement.prototype as unknown as {
    setPointerCapture: (...args: unknown[]) => void;
    releasePointerCapture: (...args: unknown[]) => void;
  };
  proto.setPointerCapture = vi.fn();
  proto.releasePointerCapture = vi.fn();
});
afterEach(cleanup);

function pose(id: string) {
  return window.__weaselTest!.getScene().nodes.find((n) => n.id === id)!.pose as { x: number; y: number };
}

describe('TransformDemo', () => {
  it('drags a rect by its body and lands its box on the 20px grid', () => {
    const { container } = render(<TransformDemo />);
    const canvas = container.querySelector('canvas')!;
    const fire = (type: string, x: number, y: number) => act(() => {
      canvas.dispatchEvent(new PointerEvent(type, { bubbles: true, clientX: x, clientY: y, pointerId: 1 }));
    });
    expect(pose('a')).toMatchObject({ x: 50, y: 80 });
    // Rect 'a' is 90x60 at (50, 80); press its center and drag by (+47, +33), off the grid.
    fire('pointerdown', 95, 110);
    fire('pointermove', 120, 130);
    fire('pointermove', 142, 143);
    fire('pointerup', 142, 143);
    // The box's center, at (142, 143), is the nearest a line on both axes.
    expect(pose('a')).toMatchObject({ x: 95, y: 110 });
  });
});
