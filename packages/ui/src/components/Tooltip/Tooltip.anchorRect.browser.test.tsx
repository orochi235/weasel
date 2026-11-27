import '@weasel-js/theme/tokens.css';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, expect, test } from 'vitest';
import { Tooltip } from '@weasel-js/ui/components/Tooltip';

// Flipping and sliding into the viewport is measured layout, and following a rect that only moves is React Aria's
// ResizeObserver's answer: a real browser's.

afterEach(cleanup);

const frames = async (n: number) => {
  for (let i = 0; i < n; i++) await new Promise((r) => requestAnimationFrame(r));
};
const at = (x: number, y: number) => (
  <Tooltip open anchorRect={{ x, y, width: 0, height: 0 }} placement="top" offset={10}>
    A card wide enough that, anchored near an edge, it would run past it unless placed back inside the window.
  </Tooltip>
);
const box = () => screen.getByRole('tooltip').getBoundingClientRect();
const inView = (r: DOMRect) => {
  expect(r.top).toBeGreaterThanOrEqual(0);
  expect(r.left).toBeGreaterThanOrEqual(0);
  expect(r.bottom).toBeLessThanOrEqual(window.innerHeight);
  expect(r.right).toBeLessThanOrEqual(window.innerWidth);
};

test('a tooltip anchored to a point sits above it, with room', async () => {
  render(at(200, 300));
  await frames(3);
  const r = box();
  expect(r.bottom).toBeLessThanOrEqual(300);
  inView(r);
});

test('a tooltip anchored to a point at the top of the window flips below it', async () => {
  render(at(200, 4));
  await frames(3);
  const r = box();
  expect(r.top).toBeGreaterThanOrEqual(4);
  inView(r);
});

test('a tooltip anchored to a point at the right edge slides back inside the window', async () => {
  render(at(window.innerWidth - 2, 300));
  await frames(3);
  inView(box());
});

test('a tooltip follows an anchor rect that only moves', async () => {
  const { rerender } = render(at(200, 300));
  await frames(3);
  const first = box();
  rerender(at(260, 340));
  await frames(3);
  const second = box();
  expect(second.left - first.left).toBeCloseTo(60, 0);
  expect(second.top - first.top).toBeCloseTo(40, 0);
});
