import { act, cleanup, render } from '@testing-library/react';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { MultiSelectDemo } from '../MultiSelectDemo';

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

describe('MultiSelectDemo', () => {
  // The demo has no readout of its selection, so this only proves the preset
  // mounts and takes a click, a shift-click, and a drag.
  it('mounts and takes a click, a shift-click, and a drag without throwing', () => {
    const { container } = render(<MultiSelectDemo />);
    const canvas = container.querySelector('canvas')!;
    canvas.getBoundingClientRect = () => ({
      left: 0, top: 0, x: 0, y: 0, width: 400, height: 300, right: 400, bottom: 300, toJSON: () => ({}),
    }) as DOMRect;
    const fire = (type: string, x: number, y: number, init: PointerEventInit = {}) => act(() => {
      canvas.dispatchEvent(new PointerEvent(type, { bubbles: true, clientX: x, clientY: y, pointerId: 1, ...init }));
    });
    fire('pointerdown', 75, 65); fire('pointerup', 75, 65);
    fire('pointerdown', 180, 100, { shiftKey: true }); fire('pointerup', 180, 100, { shiftKey: true });
    fire('pointerdown', 75, 65); fire('pointermove', 95, 65); fire('pointermove', 120, 90); fire('pointerup', 120, 90);
    expect(container.querySelector('canvas')).not.toBeNull();
  });
});
