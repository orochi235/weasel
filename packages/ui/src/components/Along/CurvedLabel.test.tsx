import { afterAll, afterEach, beforeAll, expect, test } from 'vitest';
import { cleanup, render } from '@testing-library/react';
import { lineShape } from '@weasel-js/geom';
import { CurvedLabel } from './CurvedLabel';

// jsdom lays nothing out: every grapheme is 10 wide.
const realOffset = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'offsetWidth')!;
beforeAll(() => {
  Object.defineProperty(HTMLElement.prototype, 'offsetWidth', { configurable: true, get: () => 10 });
});
afterAll(() => {
  Object.defineProperty(HTMLElement.prototype, 'offsetWidth', realOffset);
});
afterEach(cleanup);

const shape = lineShape({ x: 0, y: 0 }, { x: 200, y: 0 });
const spans = () => [...document.querySelectorAll<HTMLElement>('[role="img"] span')];
const x = (el: HTMLElement) => Number.parseFloat(el.style.getPropertyValue('--at-x'));
/** What a reader sees, left to right. */
const shown = () => spans().sort((a, b) => x(a) - x(b)).map((el) => el.textContent).join('');

test('a Hebrew word in a left-to-right label shows in display order', () => {
  render(<CurvedLabel text="ab אבג" shape={shape} />);
  expect(shown()).toBe('ab גבא');
});

test('right to left, align start puts the text against the right end, still reading forward', () => {
  render(<div dir="rtl"><CurvedLabel text="abc" shape={shape} align="start" /></div>);
  expect(shown()).toBe('abc');
  expect(Math.max(...spans().map(x))).toBeCloseTo(195);
});

test('right to left, a Hebrew label shows reversed and lays its first letter rightmost', () => {
  render(<div dir="rtl"><CurvedLabel text="אבג (1)" shape={shape} align="start" /></div>);
  expect(shown()).toBe('(1) גבא');
  const first = spans().find((el) => el.textContent === 'א')!;
  expect(x(first)).toBeCloseTo(195);
  expect(document.querySelector('[role="img"]')).toHaveAttribute('aria-label', 'אבג (1)');
});
