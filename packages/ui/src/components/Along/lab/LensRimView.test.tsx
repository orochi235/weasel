import { expect, test } from 'vitest';
import { MARK_LIMIT, savedMarks, withMark } from './LensRimView';

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
