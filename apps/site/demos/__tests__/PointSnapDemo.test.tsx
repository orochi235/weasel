import { act, cleanup, render } from '@testing-library/react';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { PointSnapDemo } from '../PointSnapDemo';

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

describe('PointSnapDemo', () => {
  // No readout of the pose, so this only proves the presets mount and take a drag.
  it('mounts and takes a drag without throwing', () => {
    const { container } = render(<PointSnapDemo />);
    const canvas = container.querySelector('canvas')!;
    canvas.getBoundingClientRect = () => ({
      left: 0, top: 0, x: 0, y: 0, width: 400, height: 300, right: 400, bottom: 300, toJSON: () => ({}),
    }) as DOMRect;
    for (const [type, x, y] of [['pointerdown', 210, 130], ['pointermove', 230, 150], ['pointermove', 260, 180], ['pointerup', 260, 180]] as const) {
      act(() => { canvas.dispatchEvent(new PointerEvent(type, { bubbles: true, clientX: x, clientY: y, pointerId: 1 })); });
    }
    expect(container.querySelector('canvas')).not.toBeNull();
  });
});
