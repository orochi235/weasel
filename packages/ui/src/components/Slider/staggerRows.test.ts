import { expect, test } from 'vitest';
import { staggerRows } from './staggerRows';

test('spans that clear each other share row 0', () => expect(staggerRows([{ start: 0, end: 10 }, { start: 20, end: 30 }], 4)).toEqual([0, 0]));
test('an overlapping span steps down to the first row it clears', () => {
  expect(staggerRows([{ start: 0, end: 10 }, { start: 8, end: 18 }, { start: 12, end: 22 }, { start: 40, end: 50 }], 4)).toEqual([0, 1, 2, 0]);
});
test('order is by start, not by input order', () => expect(staggerRows([{ start: 20, end: 30 }, { start: 0, end: 22 }], 4)).toEqual([1, 0]));
