import { act, cleanup, fireEvent, render } from '@testing-library/react';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { panAction } from '@weasel-js/kernel3d';
import { Kernel3dDemo } from '../Kernel3dDemo';

beforeAll(() => {
  const proto = HTMLCanvasElement.prototype as unknown as {
    setPointerCapture: (...args: unknown[]) => void;
    releasePointerCapture: (...args: unknown[]) => void;
  };
  proto.setPointerCapture = vi.fn();
  proto.releasePointerCapture = vi.fn();
});
afterEach(cleanup);

function orbitDrag(shift: boolean) {
  const view = render(<Kernel3dDemo />);
  fireEvent.click(view.getByRole('button', { name: /orbit/i }));
  const canvas = view.container.querySelector('canvas')!;
  const fire = (type: string, x: number) => act(() => {
    canvas.dispatchEvent(new PointerEvent(type, { bubbles: true, clientX: x, clientY: 100, pointerId: 1, shiftKey: shift }));
  });
  const readout = () => view.container.textContent!.match(/yaw\s*([^°]+)°/)![1];
  const before = readout();
  fire('pointerdown', 100);
  fire('pointermove', 130);
  fire('pointermove', 180);
  fire('pointerup', 180);
  return { before, after: readout() };
}

describe('Kernel3dDemo', () => {
  it('turns the camera on an Orbit drag', () => {
    const { before, after } = orbitDrag(false);
    expect(after).not.toBe(before);
  });

  it('pans on a Shift+drag with Orbit, the binding the orbit tool declares', () => {
    const start = vi.spyOn(panAction.invoker as { start: (...args: never[]) => unknown }, 'start');
    const { before, after } = orbitDrag(true);
    expect(start).toHaveBeenCalled();
    expect(after).toBe(before);
    start.mockRestore();
  });
});
