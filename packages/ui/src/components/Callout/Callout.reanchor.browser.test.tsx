import '@weasel-js/theme/tokens.css';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, expect, test, vi } from 'vitest';
import { Callout } from './Callout';

// Whether React Aria moves a popover after its anchor is only translated is its ResizeObserver's answer, which
// jsdom does not have.

afterEach(cleanup);

const frames = async (n: number) => {
  for (let i = 0; i < n; i++) await new Promise((r) => requestAnimationFrame(r));
};
const at = (x: number, y: number) => (
  <Callout isOpen anchorRect={{ x, y, width: 40, height: 20 }} placement="bottom" title="Here">Anchored</Callout>
);
const box = () => screen.getByRole('dialog').getBoundingClientRect();

test('a callout follows an anchor rect that only moves, each time, without a resize event on the window', async () => {
  // Vitest resets the frame's size only after the frame has loaded, so after a file that set its own viewport
  // this one starts with a resize pending.
  await frames(2);
  const onResize = vi.fn();
  window.addEventListener('resize', onResize);
  try {
    const { rerender } = render(at(100, 100));
    await frames(3);
    const first = box();

    rerender(at(180, 140));
    await frames(3);
    const second = box();
    expect(second.left - first.left).toBeCloseTo(80, 0);
    expect(second.top - first.top).toBeCloseTo(40, 0);

    rerender(at(220, 160));
    await frames(3);
    const third = box();
    expect(third.left - second.left).toBeCloseTo(40, 0);
    expect(third.top - second.top).toBeCloseTo(20, 0);

    rerender(at(100, 100));
    await frames(3);
    expect(box().left).toBeCloseTo(first.left, 0);
    expect(onResize).not.toHaveBeenCalled();
  } finally {
    window.removeEventListener('resize', onResize);
  }
});
