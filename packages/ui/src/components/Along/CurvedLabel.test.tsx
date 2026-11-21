import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterAll, afterEach, beforeAll, expect, test } from 'vitest';
import { cleanup, render } from '@testing-library/react';
import { bidi } from '@weasel-js/bidi';
import { lineShape } from '@weasel-js/geom';
import { registerBidi } from '@weasel-js/text';
import { Along } from './Along';
import { CurvedLabel } from './CurvedLabel';
import s from './CurvedLabel.module.css';

// jsdom lays nothing out: every grapheme is 10 wide.
const realOffset = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'offsetWidth')!;
let unregister: () => void;
beforeAll(() => {
  unregister = registerBidi(bidi);
  Object.defineProperty(HTMLElement.prototype, 'offsetWidth', { configurable: true, get: () => 10 });
});
afterAll(() => {
  unregister();
  Object.defineProperty(HTMLElement.prototype, 'offsetWidth', realOffset);
});
afterEach(cleanup);

const shape = lineShape({ x: 0, y: 0 }, { x: 200, y: 0 });
const spans = () => [...document.querySelectorAll<HTMLElement>('[role="img"] span')];
const x = (el: HTMLElement) => Number.parseFloat(el.style.getPropertyValue('--at-x'));
/** What a reader sees, left to right. */
const shown = () => spans().sort((a, b) => x(a) - x(b)).map((el) => el.textContent).join('');

test('a Hebrew word in a left-to-right label shows in display order', () => {
  render(<Along shape={shape}><CurvedLabel text="ab אבג" /></Along>);
  expect(shown()).toBe('ab גבא');
});

test('right to left, align start puts the text against the right end, still reading forward', () => {
  render(<div dir="rtl"><Along shape={shape} align="start"><CurvedLabel text="abc" /></Along></div>);
  expect(shown()).toBe('abc');
  expect(Math.max(...spans().map(x))).toBeCloseTo(195);
});

test('right to left, a Hebrew label shows reversed and lays its first letter rightmost', () => {
  render(<div dir="rtl"><Along shape={shape} align="start"><CurvedLabel text="אבג (1)" /></Along></div>);
  expect(shown()).toBe('(1) גבא');
  const first = spans().find((el) => el.textContent === 'א')!;
  expect(x(first)).toBeCloseTo(195);
  expect(document.querySelector('[role="img"]')).toHaveAttribute('aria-label', 'אבג (1)');
});

test('right to left, an Arabic word keeps each joined stretch in one span, laid from the right', () => {
  render(<div dir="rtl"><Along shape={shape} align="start"><CurvedLabel text="سلام" /></Along></div>);
  expect(spans().sort((a, b) => x(b) - x(a)).map((el) => el.textContent)).toEqual(['سلا', 'م']);
  expect(document.querySelector('[role="img"]')).toHaveAttribute('aria-label', 'سلام');
});

test('offset lays a label that fits back along the track from where align puts it', () => {
  render(<Along shape={shape}><CurvedLabel text="abc" offset={40} /></Along>);
  spans().map(x).forEach((at, i) => expect(at).toBeCloseTo([50, 60, 70][i]!));
});

test('outside an Along it is its text on one line, still named by it', () => {
  render(<CurvedLabel text="abc" />);
  expect(spans()).toHaveLength(0);
  expect(document.querySelector('[role="img"]')).toHaveTextContent('abc');
  expect(document.querySelector('[role="img"]')).toHaveAttribute('aria-label', 'abc');
});

test('outside an Along the label takes its place in the flow, and along one it spans the run’s box', () => {
  const style = document.createElement('style');
  style.textContent = readFileSync(resolve(__dirname, 'CurvedLabel.module.css'), 'utf8').replaceAll('.label', `.${s.label!.split(' ')[0]}`);
  document.head.append(style);
  try {
    const plain = render(<CurvedLabel text="abc" />);
    expect(getComputedStyle(plain.getByRole('img')).position).not.toBe('absolute');
    plain.unmount();
    const laid = render(<Along shape={shape}><CurvedLabel text="abc" /></Along>);
    expect(getComputedStyle(laid.getByRole('img')).position).toBe('absolute');
  } finally {
    style.remove();
  }
});
