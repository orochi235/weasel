import { afterEach, beforeEach, expect, test } from 'vitest';
import { cleanup, fireEvent, render } from '@testing-library/react';
import { LensRimView, MARK_LIMIT, savedMarks, withMark, type LensRimConfig } from './LensRimView';

beforeEach(() => localStorage.clear());
afterEach(() => {
  cleanup();
  localStorage.clear();
});

test('a mark past the limit lets the oldest go', () => {
  let marks = Array.from({ length: MARK_LIMIT }, (_, i) => ({ x: i, y: 0 }));
  marks = withMark(marks, { x: -1, y: 0 });
  expect(marks).toHaveLength(MARK_LIMIT);
  expect(marks[0]).toEqual({ x: 1, y: 0 });
  expect(marks.at(-1)).toEqual({ x: -1, y: 0 });
});

test('saved marks that are not a list of points read as none, and points without finite coordinates drop out', () => {
  expect(savedMarks({})).toEqual([]);
  expect(savedMarks('ab')).toEqual([]);
  expect(savedMarks(undefined)).toEqual([]);
  expect(savedMarks([{ x: 0.5, y: 0.25 }, { x: 1 }, { x: 1, y: null }, null, { x: Number.NaN, y: 0 }])).toEqual([{ x: 0.5, y: 0.25 }]);
});

const config = (size: number): LensRimConfig => ({ size, turn: 0, actions: 2, overflow: 'scroll', boxes: false });
const markAt = () => {
  const el = document.querySelector<HTMLElement>('[data-mark]')!;
  return [el.style.getPropertyValue('--x'), el.style.getPropertyValue('--y')];
};

test('a mark stays on the spot of the picture it marked when the lens changes size', () => {
  // jsdom puts the lens at (0, 0) with no size, so a press at (0, 0) is the picture's middle.
  const view = render(<LensRimView config={config(200)} />);
  fireEvent.pointerDown(document.querySelector('[data-lens-picture]')!, { clientX: 0, clientY: 0 });
  expect(markAt()).toEqual(['100px', '100px']);
  view.rerender(<LensRimView config={config(400)} />);
  expect(markAt()).toEqual(['200px', '200px']);
});
