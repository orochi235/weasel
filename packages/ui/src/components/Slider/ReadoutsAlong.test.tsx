import { afterEach, expect, it, vi } from 'vitest';
import { act, cleanup, render } from '@testing-library/react';
import { ReadoutsAlong } from './ReadoutsAlong';

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

it('restacks its rows when a readout changes size after layout, as a font load makes it', () => {
  let notify = (): void => {};
  vi.stubGlobal('ResizeObserver', class {
    constructor(cb: () => void) { notify = cb; }
    observe() {}
    disconnect() {}
  });
  let width = 10;
  const offset = vi.spyOn(HTMLElement.prototype, 'offsetWidth', 'get').mockImplementation(() => width);
  try {
    const { container } = render(
      <ReadoutsAlong readouts={[{ g: 0.4, content: 'a' }, { g: 0.6, content: 'b' }]} place={() => ({})} length={100} />,
    );
    const rows = () => [...container.querySelectorAll<HTMLElement>('[data-readout]')].map((el) => el.style.getPropertyValue('--row'));
    expect(rows()).toEqual(['0', '0']);
    width = 30;
    act(() => notify());
    expect(rows()).toEqual(['0', '1']);
  } finally {
    offset.mockRestore();
  }
});
