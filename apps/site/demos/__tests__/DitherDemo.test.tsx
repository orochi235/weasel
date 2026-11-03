import { act, cleanup, fireEvent, render } from '@testing-library/react';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { DitherDemo } from '../DitherDemo';

beforeAll(() => {
  const proto = HTMLCanvasElement.prototype as unknown as {
    getContext: (...args: unknown[]) => unknown;
  };
  proto.getContext = vi.fn(() => null);
});
afterEach(cleanup);

describe('DitherDemo', () => {
  it('mounts, and takes every value of every control without throwing', async () => {
    const { container, getByRole } = render(<DitherDemo />);
    expect(container.querySelectorAll('canvas').length).toBe(2);

    const pick = async (name: string) => {
      const radio = getByRole('radio', { name });
      await act(async () => { fireEvent.click(radio); });
      expect(radio.getAttribute('aria-checked')).toBe('true');
    };
    for (const name of ['180 dpi', '300 dpi', 'Screen']) await pick(name);
    for (const name of ['Bayer', 'Floyd–Steinberg', 'Atkinson', 'Threshold']) await pick(name);
    await pick('300 dpi');
    for (const name of ['By mask', 'Off', 'By layer']) await pick(name);

    const range = container.querySelector('input[type="range"]')!;
    await act(async () => { fireEvent.change(range, { target: { value: '90' } }); });
    expect(container.querySelector('output')?.textContent).toBe('90');
  });

  it('says on the canvas when it shows Bayer in place of a diffusion method', async () => {
    const { getByRole, getByText } = render(<DitherDemo />);
    await act(async () => { fireEvent.click(getByRole('radio', { name: 'Atkinson' })); });
    expect(getByText(/Canvas: Bayer on the GPU/)).toBeTruthy();
    expect(getByText(/Export at 180 dpi, Atkinson/)).toBeTruthy();
  });
});
