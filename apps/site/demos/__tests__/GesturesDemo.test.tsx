import { act, cleanup, fireEvent, render } from '@testing-library/react';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { GesturesDemo } from '../GesturesDemo';

beforeAll(() => {
  HTMLElement.prototype.setPointerCapture ??= () => {};
  HTMLElement.prototype.releasePointerCapture ??= () => {};
});
afterEach(cleanup);

describe('GesturesDemo', () => {
  it('starts no gesture on a press of any button but the primary one', async () => {
    const { container, getByRole } = render(<GesturesDemo />);
    await act(async () => { fireEvent.click(getByRole('radio', { name: 'click vs drag' })); });
    const canvas = container.querySelector('canvas')!;
    const readout = container.querySelector('.ckd-gestures-readout')!;
    const hint = readout.textContent;
    await act(async () => {
      fireEvent.pointerDown(canvas, { button: 2, buttons: 2, pointerId: 1, clientX: 50, clientY: 50 });
      fireEvent.pointerUp(canvas, { button: 2, buttons: 0, pointerId: 1, clientX: 120, clientY: 50 });
    });
    expect(readout.textContent).toBe(hint);
  });
});
