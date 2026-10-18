import { act, cleanup, render } from '@testing-library/react';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import type { RotatedPose } from '@weasel-js/core';
import { ResizeSnapDemo } from '../ResizeSnapDemo';

beforeAll(() => {
  window.history.replaceState(null, '', '/?test=1');
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

/** The world position of the rotated rect's bottom-right corner. */
function bottomRight() {
  const p = window.__weaselTest!.getScene().nodes.find((n) => n.id === 'a')!.pose as RotatedPose;
  const cos = Math.cos(p.rotation ?? 0), sin = Math.sin(p.rotation ?? 0);
  const hw = p.width / 2, hh = p.height / 2;
  return { x: p.x + hw + hw * cos - hh * sin, y: p.y + hh + hw * sin + hh * cos };
}

describe('ResizeSnapDemo', () => {
  it('lands a dragged corner of the rotated rect on a grid point', () => {
    const { container } = render(<ResizeSnapDemo />);
    const canvas = container.querySelector('canvas')!;
    canvas.getBoundingClientRect = () => ({
      left: 0, top: 0, x: 0, y: 0, width: 400, height: 300, right: 400, bottom: 300, toJSON: () => ({}),
    }) as DOMRect;
    const start = bottomRight();
    expect(start.x).toBeCloseTo(238.3, 1);
    expect(start.y).toBeCloseTo(180.98, 1);

    for (const [type, x, y] of [
      ['pointerdown', start.x, start.y], ['pointermove', 250, 190], ['pointermove', 263, 197], ['pointerup', 263, 197],
    ] as const) {
      act(() => { canvas.dispatchEvent(new PointerEvent(type, { bubbles: true, clientX: x, clientY: y, pointerId: 1 })); });
    }
    const end = bottomRight();
    expect(end.x).toBeCloseTo(260, 3);
    expect(end.y).toBeCloseTo(200, 3);
  });
});
